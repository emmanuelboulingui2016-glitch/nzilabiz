import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "nzilabiz_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET manquant — copiez .env.example en .env et renseignez-le.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  storeId: string;
  role: "PATRON" | "GERANT" | "VENDEUR";
  deviceId?: string;
  email: string;
  nom: string;
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Réservé au HTTPS en production. Exception assumée : le mode présentation, où l'application
    // tourne sur un ordinateur du réseau local en http://192.168.x.x. Sans cette exception le
    // navigateur du téléphone refuse silencieusement le cookie et la connexion échoue sans
    // message. MODE_PRESENTATION doit rester absent de toute vraie mise en ligne.
    secure: process.env.NODE_ENV === "production" && process.env.MODE_PRESENTATION !== "1",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
