import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { db } from "@/db/client";
import { users, stores, devices, notificationSettings } from "@/db/schema";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { deviceNameFromUserAgent } from "@/lib/device-name";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith("nzilabiz_oauth_state="))
    ?.split("=")[1];

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/connexion?error=google_etat_invalide", appUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/connexion?error=google_echec_token", appUrl));
  }
  const tokenJson = (await tokenRes.json()) as { id_token: string };

  const { payload } = await jwtVerify(tokenJson.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  const email = payload.email as string;
  const nom = (payload.name as string) ?? email;
  const googleId = payload.sub as string;

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user) {
    // Nouveau compte via Google : boutique créée avec un nom provisoire, à renommer dans
    // Paramètres > Boutique (simplification assumée pour ne pas bloquer sur un écran intermédiaire).
    const [store] = await db.insert(stores).values({ nom: "Ma boutique", plan: "ESSAI" }).returning();
    await db.insert(notificationSettings).values({ storeId: store.id });
    [user] = await db.insert(users).values({ storeId: store.id, nom, email, googleId, role: "PATRON" }).returning();
  } else if (!user.googleId) {
    await db.update(users).set({ googleId }).where(eq(users.id, user.id));
  }

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

  const res = NextResponse.redirect(new URL("/dashboard", appUrl));
  res.cookies.delete("nzilabiz_oauth_state");
  await setSessionCookie(token);
  return res;
}
