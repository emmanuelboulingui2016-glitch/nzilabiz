import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users, stores } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { bloquerSiExpiree, bloquerSiPlafondComptes, etatBoutiqueCourante } from "@/lib/abonnement";
import { normaliserTelephone } from "@/lib/telephone";

// Onglet Utilisateurs — §14 du cahier des charges.
// 🔧 Simplification documentée (voir résumé de tâche / README) : il n'y a pas de service d'envoi
// d'e-mail configuré dans ce build. "Inviter un employé" crée donc directement la ligne `users`
// avec un mot de passe temporaire généré côté serveur, renvoyé UNE SEULE FOIS dans la réponse pour
// que le Patron le relaie manuellement (SMS/WhatsApp/oral) à l'employé. Un vrai flux d'invitation
// par e-mail est hors périmètre de ce soir.

const inviteSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est requis.").max(120),
  telephone: z.string().trim().min(1, "Le numéro de téléphone est requis.").max(30),
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
      telephone: u.telephone,
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

  // Plafond de comptes de la formule. Vérifié ici et à l'acceptation de l'invitation : ce sont
  // les deux seuls endroits où une ligne `users` naît.
  const etatFormule = await etatBoutiqueCourante();
  const plafond = await bloquerSiPlafondComptes(session.storeId, etatFormule?.plan ?? "ESSAI");
  if (plafond) return plafond;

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { nom, telephone, role } = parsed.data;

  // Le compte d'un employé s'identifie par son numéro, pas par une adresse : c'est la règle « une
  // adresse par boutique », celle du patron. Inventer une adresse à un vendeur qui n'en a pas lui
  // donnait un identifiant qu'il ne retenait pas, et le patron finissait par la noter sur un
  // papier collé à la caisse.
  //
  // Requêtes enchaînées, jamais en parallèle : le pooler en mode transaction ne rend pas la main
  // quand plusieurs requêtes partent ensemble depuis une même requête HTTP (voir README).
  const boutique = await db.query.stores.findFirst({
    where: eq(stores.id, session.storeId),
    columns: { indicatif: true },
  });

  const numero = normaliserTelephone(telephone, boutique?.indicatif);
  if (!numero) {
    return NextResponse.json({ error: "Ce numéro de téléphone n'est pas valide." }, { status: 400 });
  }

  const existing = await db.query.users.findFirst({ where: eq(users.telephone, numero) });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec ce numéro." }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const motDePasseHash = await hashPassword(tempPassword);

  const [created] = await db
    .insert(users)
    .values({ storeId: session.storeId, nom, telephone: numero, role, motDePasseHash })
    .returning();

  return NextResponse.json({
    ok: true,
    user: {
      id: created.id,
      nom: created.nom,
      email: created.email,
      telephone: created.telephone,
      role: created.role,
      derniereConnexion: null,
      creeLe: created.creeLe.toISOString(),
      aMotDePasse: true,
      googleId: false,
    },
    tempPassword,
  });
}
