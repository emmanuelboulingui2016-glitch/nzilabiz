// POST /api/boutiques/basculer — changer de boutique active dans un réseau Entreprise.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { roleDansBoutique } from "@/lib/reseau";

const schema = z.object({ storeId: z.string().min(1) });

/**
 * La bascule réécrit `storeId` — et le rôle — dans le jeton de session. Trois points de vigilance,
 * parce que c'est la seule route de l'application qui déplace un compte d'un tenant à l'autre :
 *
 *  - **L'autorisation vient de la base, jamais du corps de la requête.** `roleDansBoutique` relit
 *    la boutique d'origine du compte et ses rattachements. Sans ça, poster l'identifiant de la
 *    boutique d'un autre commerçant suffirait à s'y introduire.
 *  - **Le rôle est celui de la boutique visée**, pas celui de la session en cours : un patron chez
 *    lui n'est pas patron partout.
 *  - **L'appareil ne change pas.** Il serait plus propre d'enregistrer l'appareil dans chaque
 *    boutique, mais la révocation d'un téléphone volé porte sur `devices.id` : garder le même
 *    identifiant fait qu'une révocation coupe l'accès à *toutes* les boutiques du réseau. Un
 *    affichage un peu moins net vaut mieux qu'un téléphone volé qui reste dedans.
 *
 * Aucun contrôle d'abonnement ici : la bascule n'écrit aucune donnée métier, et une boutique dont
 * l'échéance est passée sera de toute façon arrêtée par le calque de l'application.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const { storeId } = parsed.data;
  if (storeId === session.storeId) return NextResponse.json({ ok: true, inchange: true });

  const role = await roleDansBoutique(session.userId, storeId);
  if (!role) {
    return NextResponse.json({ error: "Vous n'avez pas accès à cette boutique." }, { status: 403 });
  }

  const token = await createSessionToken({
    userId: session.userId,
    storeId,
    role,
    deviceId: session.deviceId,
    email: session.email,
    nom: session.nom,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, storeId, role });
}
