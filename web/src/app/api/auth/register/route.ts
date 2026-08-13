import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { stores, users, devices, notificationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation/auth";
import { deviceNameFromUserAgent } from "@/lib/device-name";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { nom, email, password, storeName } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail." }, { status: 409 });
  }

  const motDePasseHash = await hashPassword(password);
  const essaiExpireLe = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 jours d'essai gratuit (§16)

  const [store] = await db
    .insert(stores)
    .values({ nom: storeName, plan: "ESSAI", essaiExpireLe })
    .returning();

  const [user] = await db
    .insert(users)
    .values({ storeId: store.id, nom, email, motDePasseHash, role: "PATRON" })
    .returning();

  await db.insert(notificationSettings).values({ storeId: store.id });

  const deviceName = deviceNameFromUserAgent(request.headers.get("user-agent"));
  const [device] = await db
    .insert(devices)
    .values({ storeId: store.id, userId: user.id, nom: deviceName, userAgent: request.headers.get("user-agent") })
    .returning();

  const token = await createSessionToken({
    userId: user.id,
    storeId: store.id,
    role: "PATRON",
    deviceId: device.id,
    email: user.email,
    nom: user.nom,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true, storeId: store.id });
}
