// Suppression du compte — accessible à tous les rôles, chacun pour son propre compte.
//
// Deux comportements selon le rôle, parce que les conséquences ne sont pas les mêmes :
//
// - PATRON : il est le propriétaire de la boutique. Supprimer son compte supprime la boutique
//   entière et TOUT ce qu'elle contient (produits, ventes, clients, documents, employés…), par
//   cascade sur `stores`. Irréversible, donc protégé par le mot de passe et la saisie exacte du
//   nom de la boutique.
// - GERANT / VENDEUR : la ligne `users` n'est pas supprimée mais anonymisée et désactivée. Ses
//   ventes passées doivent rester dans l'historique et les rapports de la boutique — les effacer
//   fausserait la comptabilité du commerçant, qui n'est pas l'auteur de la demande.
//
// Dans les deux cas la session est immédiatement invalidée.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { devices, stores, users } from "@/db/schema";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const bodySchema = z.object({
  motDePasse: z.string().optional(),
  confirmation: z.string().trim().min(1, "Confirmation requise."),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Le mot de passe est vérifié ici : sans limite, l'endpoint deviendrait un oracle pour le
  // deviner depuis une session volée.
  const limite = await rateLimit(`compte:suppression:${session.userId}:${clientIp(request)}`, {
    limite: 5,
    fenetreMs: 15 * 60_000,
    blocageMs: 30 * 60_000,
  });
  if (!limite.ok) {
    return tooManyRequests(limite.retryAfter, "Trop de tentatives. Réessayez dans un moment.");
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Un compte créé via Google n'a pas de mot de passe : la confirmation textuelle fait foi.
  if (user.motDePasseHash) {
    if (!parsed.data.motDePasse) {
      return NextResponse.json({ error: "Mot de passe requis pour confirmer la suppression." }, { status: 400 });
    }
    const valide = await verifyPassword(parsed.data.motDePasse, user.motDePasseHash);
    if (!valide) return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 400 });
  }

  const store = await db.query.stores.findFirst({ where: eq(stores.id, session.storeId) });
  if (!store) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  if (session.role === "PATRON") {
    if (parsed.data.confirmation !== store.nom) {
      return NextResponse.json(
        { error: `Saisissez exactement le nom de la boutique pour confirmer : ${store.nom}` },
        { status: 400 }
      );
    }
    // Cascade : users, devices, products, sales, clients, documents… tout part avec la boutique.
    await db.delete(stores).where(eq(stores.id, store.id));
    await clearSessionCookie();
    return NextResponse.json({ ok: true, portee: "BOUTIQUE" });
  }

  if (parsed.data.confirmation !== "SUPPRIMER") {
    return NextResponse.json({ error: 'Saisissez « SUPPRIMER » pour confirmer.' }, { status: 400 });
  }

  // Anonymisation : plus aucune donnée personnelle, mais l'identifiant reste pour que les ventes
  // passées gardent un auteur. L'e-mail est remplacé par une valeur unique et non routable pour
  // ne pas bloquer une future réinscription avec la même adresse (la colonne est unique).
  await db
    .update(users)
    .set({
      nom: "Compte supprimé",
      email: `supprime+${user.id}@compte.invalid`,
      motDePasseHash: null,
      googleId: null,
      photoUrl: null,
      desactiveLe: new Date(),
    })
    .where(eq(users.id, user.id));

  await db
    .update(devices)
    .set({ revoque: true })
    .where(and(eq(devices.userId, user.id), eq(devices.revoque, false)));

  await clearSessionCookie();
  return NextResponse.json({ ok: true, portee: "COMPTE" });
}
