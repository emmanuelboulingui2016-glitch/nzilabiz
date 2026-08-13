import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, devices } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";
import { deviceNameFromUserAgent } from "@/lib/device-name";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || !user.motDePasseHash || !(await verifyPassword(password, user.motDePasseHash))) {
    return NextResponse.json({ error: "E-mail ou mot de passe incorrect." }, { status: 401 });
  }

  await db.update(users).set({ derniereConnexion: new Date() }).where(eq(users.id, user.id));

  const deviceName = deviceNameFromUserAgent(request.headers.get("user-agent"));
  const [device] = await db
    .insert(devices)
    .values({ storeId: user.storeId, userId: user.id, nom: deviceName, userAgent: request.headers.get("user-agent") })
    .returning();

  const token = await createSessionToken({
    userId: user.id,
    storeId: user.storeId,
    role: user.role,
    deviceId: device.id,
    email: user.email,
    nom: user.nom,
  });
  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
