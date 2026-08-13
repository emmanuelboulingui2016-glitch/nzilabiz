import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateBase32Secret, verifyTotp } from "@/components/parametres/securite/totp";

// Onglet Sécurité & connexion — §14 du cahier des charges.
// Une seule route PUT avec un champ `action` discriminant : profil, mot de passe, 2FA
// (init/verify/disable). Voir totp.ts pour le détail de la simplification 2FA assumée.

const profileSchema = z.object({ action: z.literal("profile"), nom: z.string().trim().min(1).max(120) });

const passwordSchema = z.object({
  action: z.literal("password"),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères."),
});

const twoFaInitSchema = z.object({ action: z.literal("2fa-init") });
const twoFaVerifySchema = z.object({ action: z.literal("2fa-verify"), code: z.string().min(6).max(6) });
const twoFaDisableSchema = z.object({ action: z.literal("2fa-disable") });

const bodySchema = z.discriminatedUnion("action", [
  profileSchema,
  passwordSchema,
  twoFaInitSchema,
  twoFaVerifySchema,
  twoFaDisableSchema,
]);

function serializeUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    nom: u.nom,
    email: u.email,
    aMotDePasse: Boolean(u.motDePasseHash),
    googleLie: Boolean(u.googleId),
    twoFactorActive: u.twoFactorActive,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.securite")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  return NextResponse.json({ user: serializeUser(user) });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!can(session.role, "parametres.securite")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const data = parsed.data;

  if (data.action === "profile") {
    const [updated] = await db.update(users).set({ nom: data.nom }).where(eq(users.id, user.id)).returning();
    return NextResponse.json({ ok: true, user: serializeUser(updated) });
  }

  if (data.action === "password") {
    if (user.motDePasseHash) {
      if (!data.currentPassword) {
        return NextResponse.json({ error: "Mot de passe actuel requis." }, { status: 400 });
      }
      const valid = await verifyPassword(data.currentPassword, user.motDePasseHash);
      if (!valid) {
        return NextResponse.json({ error: "Mot de passe actuel incorrect." }, { status: 400 });
      }
    }
    const motDePasseHash = await hashPassword(data.newPassword);
    const [updated] = await db
      .update(users)
      .set({ motDePasseHash })
      .where(eq(users.id, user.id))
      .returning();
    return NextResponse.json({ ok: true, user: serializeUser(updated) });
  }

  if (data.action === "2fa-init") {
    // Génère un nouveau secret et le stocke, mais n'active PAS le 2FA tant que l'utilisateur n'a
    // pas confirmé un code valide (évite de se retrouver bloqué avec un secret mal recopié).
    const secret = generateBase32Secret();
    await db.update(users).set({ twoFactorSecret: secret, twoFactorActive: false }).where(eq(users.id, user.id));
    return NextResponse.json({
      ok: true,
      secret,
      otpauthUri: `otpauth://totp/NzilaBiz:${encodeURIComponent(user.email)}?secret=${secret}&issuer=NzilaBiz&digits=6&period=30`,
    });
  }

  if (data.action === "2fa-verify") {
    if (!user.twoFactorSecret) {
      return NextResponse.json({ error: "Aucune configuration 2FA en cours — relancez l'activation." }, { status: 400 });
    }
    const ok = verifyTotp(user.twoFactorSecret, data.code);
    if (!ok) {
      return NextResponse.json({ error: "Code invalide ou expiré. Réessayez." }, { status: 400 });
    }
    const [updated] = await db
      .update(users)
      .set({ twoFactorActive: true })
      .where(eq(users.id, user.id))
      .returning();
    return NextResponse.json({ ok: true, user: serializeUser(updated) });
  }

  // action === "2fa-disable"
  const [updated] = await db
    .update(users)
    .set({ twoFactorActive: false, twoFactorSecret: null })
    .where(eq(users.id, user.id))
    .returning();
  return NextResponse.json({ ok: true, user: serializeUser(updated) });
}
