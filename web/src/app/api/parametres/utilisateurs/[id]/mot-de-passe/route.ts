// Réinitialisation du mot de passe d'un employé par le Patron.
//
// Il n'y a pas d'envoi d'e-mail dans ce service : sans cette route, un employé qui oublie son mot
// de passe n'a aucun recours, et le Patron devait supprimer puis recréer son compte — ce qui lui
// faisait perdre le lien avec ses ventes passées. Dans une boutique, le patron est physiquement
// présent : lui remettre un mot de passe temporaire de vive voix est le chemin réel.
//
// Le mot de passe n'est renvoyé qu'une fois, dans la réponse, et n'est jamais conservé en clair.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { bloquerSiExpiree } from "@/lib/abonnement";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Une réinitialisation en rafale sur plusieurs comptes est le geste d'un accès détourné, pas
  // celui d'un patron qui dépanne un vendeur.
  const limite = await rateLimit(`mdp:reset:${session.storeId}:${clientIp(request)}`, {
    limite: 10,
    fenetreMs: 60 * 60_000,
    blocageMs: 60 * 60_000,
  });
  if (!limite.ok) {
    return tooManyRequests(limite.retryAfter, "Trop de réinitialisations. Réessayez dans une heure.");
  }

  const { id } = await params;
  const cible = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId)),
  });
  if (!cible) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Un compte supprimé par son titulaire ne se réactive pas d'une réinitialisation : il a demandé
  // l'effacement de ses informations personnelles.
  if (cible.desactiveLe) {
    return NextResponse.json({ error: "Ce compte a été supprimé par son titulaire." }, { status: 400 });
  }

  const tempPassword = generateTempPassword();
  await db.update(users).set({ motDePasseHash: await hashPassword(tempPassword) }).where(eq(users.id, id));

  return NextResponse.json({ ok: true, nom: cible.nom, tempPassword });
}
