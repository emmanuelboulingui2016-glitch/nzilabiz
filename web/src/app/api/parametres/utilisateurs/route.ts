import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { bloquerSiExpiree } from "@/lib/abonnement";

// Onglet Utilisateurs — §14 du cahier des charges.
// 🔧 Simplification documentée (voir résumé de tâche / README) : il n'y a pas de service d'envoi
// d'e-mail configuré dans ce build. "Inviter un employé" crée donc directement la ligne `users`
// avec un mot de passe temporaire généré côté serveur, renvoyé UNE SEULE FOIS dans la réponse pour
// que le Patron le relaie manuellement (SMS/WhatsApp/oral) à l'employé. Un vrai flux d'invitation
// par e-mail est hors périmètre de ce soir.

const inviteSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est requis.").max(120),
  email: z.string().trim().email("E-mail invalide.").toLowerCase(),
  role: z.enum(["PATRON", "GERANT", "VENDEUR"]),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const list = await db.query.users.findMany({
    where: eq(users.storeId, session.storeId),
    orderBy: (u, { asc }) => [asc(u.creeLe)],
  });

  return NextResponse.json({
    users: list.map((u) => ({
      id: u.id,
      nom: u.nom,
      email: u.email,
      role: u.role,
      derniereConnexion: u.derniereConnexion ? u.derniereConnexion.toISOString() : null,
      creeLe: u.creeLe.toISOString(),
      aMotDePasse: Boolean(u.motDePasseHash),
      googleId: Boolean(u.googleId),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Échéance d'abonnement dépassée : l'écriture est refusée côté serveur, pas seulement
  // masquée dans l'interface.
  const bloque = await bloquerSiExpiree();
  if (bloque) return bloque;
  if (!can(session.role, "parametres.utilisateurs")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { nom, email, role } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const motDePasseHash = await hashPassword(tempPassword);

  const [created] = await db
    .insert(users)
    .values({ storeId: session.storeId, nom, email, role, motDePasseHash })
    .returning();

  return NextResponse.json({
    ok: true,
    user: {
      id: created.id,
      nom: created.nom,
      email: created.email,
      role: created.role,
      derniereConnexion: null,
      creeLe: created.creeLe.toISOString(),
      aMotDePasse: true,
      googleId: false,
    },
    tempPassword,
  });
}
