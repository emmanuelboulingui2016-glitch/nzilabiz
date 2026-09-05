import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession, peut } from "@/lib/auth/session";
import { countPatrons } from "@/components/parametres/utilisateurs/queries";
import { calculerExpirationRestauration } from "@/components/parametres/utilisateurs/permissions-logic";
import { bloquerSiExpiree } from "@/lib/abonnement";
import { normaliserTelephone } from "@/lib/telephone";
import { stores, devices } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const majSchema = z
  .object({
    nom: z.string().trim().min(1, "Le nom est requis.").max(120).optional(),
    role: z.enum(["PATRON", "GERANT", "VENDEUR"]).optional(),
    telephone: z.string().trim().max(30).optional().nullable(),
  })
  .refine((v) => v.nom !== undefined || v.role !== undefined || v.telephone !== undefined, {
    message: "Aucune modification fournie.",
  });

// PUT /api/parametres/utilisateurs/[id] — corriger le nom, le rôle ou le numéro d'un membre.
//
// Le numéro fait partie de ce qu'on peut corriger, et ce n'est pas un détail : un vendeur change
// de puce ou de téléphone plus souvent qu'on ne croit. Sans cette route, la seule issue serait de
// supprimer son compte et d'en créer un autre — en perdant le rattachement de toutes ses ventes
// passées, qui portent son identifiant.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "parametres.utilisateurs"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = majSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  // Le filtre porte aussi sur la boutique : sans lui, l'identifiant d'un employé d'un autre
  // commerçant suffirait à modifier son compte. `isNull(desactiveLe)` : un compte supprimé
  // (chantier B) ne se modifie pas, il se restaure d'abord (.../[id]/restaurer).
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId), isNull(users.desactiveLe)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (parsed.data.role && target.role === "PATRON" && parsed.data.role !== "PATRON") {
    const remaining = await countPatrons(session.storeId, target.id);
    if (remaining === 0) {
      return NextResponse.json(
        { error: "Impossible de rétrograder le dernier Patron de la boutique." },
        { status: 400 }
      );
    }
  }

  const maj: { nom?: string; role?: "PATRON" | "GERANT" | "VENDEUR"; telephone?: string | null } = {};
  if (parsed.data.nom !== undefined) maj.nom = parsed.data.nom;
  if (parsed.data.role !== undefined) maj.role = parsed.data.role;

  if (parsed.data.telephone !== undefined) {
    const brut = parsed.data.telephone?.trim() ?? "";
    if (!brut) {
      // On ne retire un numéro que si le compte garde une adresse pour se connecter. Sinon on
      // enfermerait quelqu'un dehors d'un simple champ vidé par inadvertance.
      if (!target.email) {
        return NextResponse.json(
          { error: "Ce compte se connecte avec son numéro : il ne peut pas être retiré." },
          { status: 400 }
        );
      }
      maj.telephone = null;
    } else {
      const boutique = await db.query.stores.findFirst({
        where: eq(stores.id, session.storeId),
        columns: { indicatif: true },
      });
      const normalise = normaliserTelephone(brut, boutique?.indicatif);
      if (!normalise) {
        return NextResponse.json({ error: "Ce numéro de téléphone n'est pas valide." }, { status: 400 });
      }
      const occupe = await db.query.users.findFirst({ where: eq(users.telephone, normalise) });
      if (occupe && occupe.id !== target.id) {
        return NextResponse.json({ error: "Ce numéro est déjà utilisé par un autre compte." }, { status: 409 });
      }
      maj.telephone = normalise;
    }
  }

  // Le SELECT préalable a déjà vérifié l'appartenance à la boutique, mais on la refiltre ici :
  // défense en profondeur si ce SELECT venait à disparaître dans une future refactorisation.
  const [updated] = await db
    .update(users)
    .set(maj)
    .where(and(eq(users.id, id), eq(users.storeId, session.storeId)))
    .returning();

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      nom: updated.nom,
      email: updated.email,
      telephone: updated.telephone,
      role: updated.role,
      derniereConnexion: updated.derniereConnexion ? updated.derniereConnexion.toISOString() : null,
      creeLe: updated.creeLe.toISOString(),
      aMotDePasse: Boolean(updated.motDePasseHash),
      googleId: Boolean(updated.googleId),
    },
  });
}

const deleteSchema = z.object({
  // Optionnel côté schéma : un compte connecté par Google n'a pas de mot de passe, voir plus bas.
  motDePasse: z.string().optional(),
});

// DELETE /api/parametres/utilisateurs/[id] — supprimer le compte d'un employé.
//
// Toujours un UPDATE, jamais un DELETE : l'historique de ses ventes (sales.user_id) doit rester
// intact, il appartient à la comptabilité de la boutique, pas au compte de l'employé. On réutilise
// `desactiveLe`, déjà vérifié à la connexion (session.ts) — un second marqueur concurrent aurait fini
// par diverger. `restaurationExpireLe` distingue cette suppression, décidée par le patron et
// restaurable 48h, de l'auto-suppression anonymisée et définitive de /api/parametres/compte (qui,
// elle, laisse `restaurationExpireLe` à `null`).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!(await peut(session, "parametres.utilisateurs"))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Le mot de passe est vérifié ici : sans limite, l'endpoint deviendrait un oracle pour le deviner
  // depuis une session volée — même raisonnement que /api/parametres/compte.
  const limite = await rateLimit(`utilisateurs:suppression:${session.userId}:${clientIp(request)}`, {
    limite: 5,
    fenetreMs: 15 * 60_000,
    blocageMs: 30 * 60_000,
  });
  if (!limite.ok) {
    return tooManyRequests(limite.retryAfter, "Trop de tentatives. Réessayez dans un moment.");
  }

  const { id } = await params;

  // isNull(desactiveLe) : un compte déjà supprimé ne se supprime pas une seconde fois — il se
  // restaure, ou attend l'expiration de sa fenêtre de restauration.
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.storeId, session.storeId), isNull(users.desactiveLe)),
  });
  if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (target.id === session.userId) {
    return NextResponse.json({ error: "Vous ne pouvez pas vous retirer vous-même." }, { status: 400 });
  }

  if (target.role === "PATRON") {
    const remaining = await countPatrons(session.storeId, target.id);
    if (remaining === 0) {
      return NextResponse.json(
        { error: "Impossible de retirer le dernier Patron de la boutique." },
        { status: 400 }
      );
    }
  }

  const parsed = deleteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  // Confirmation par le mot de passe de CELUI QUI AGIT (le patron), pas celui de l'employé visé —
  // c'est le même procédé que /api/parametres/compte (voir delete-account.tsx), repris tel quel
  // plutôt que réinventé : on authentifie la session qui déclenche l'action destructrice.
  const acteur = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!acteur) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  // Un patron connecté par Google n'a pas de mot de passe : la présence même d'une session valide
  // fait foi, comme pour l'auto-suppression.
  if (acteur.motDePasseHash) {
    if (!parsed.data.motDePasse) {
      return NextResponse.json({ error: "Mot de passe requis pour confirmer la suppression." }, { status: 400 });
    }
    const valide = await verifyPassword(parsed.data.motDePasse, acteur.motDePasseHash);
    if (!valide) return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 400 });
  }

  const maintenant = new Date();
  const restaurationExpireLe = calculerExpirationRestauration(maintenant);

  await db
    .update(users)
    .set({ desactiveLe: maintenant, desactiveParId: session.userId, restaurationExpireLe })
    .where(and(eq(users.id, id), eq(users.storeId, session.storeId)));

  // L'accès est déjà coupé immédiatement par `desactiveLe` (vérifié à chaque requête dans
  // session.ts), même session ouverte comprise. On révoque aussi ses appareils pour que l'écran
  // Synchronisation reflète correctement l'état — pas pour la sécurité elle-même, déjà assurée.
  await db.update(devices).set({ revoque: true }).where(and(eq(devices.userId, id), eq(devices.revoque, false)));

  return NextResponse.json({ ok: true, restaurationExpireLe: restaurationExpireLe.toISOString() });
}
