import { NextResponse } from "next/server";
import { googleConfigure, GOOGLE_STATE_COOKIE } from "@/lib/auth/google";

// Démarre le flux OAuth2 « Authorization Code » de Google — §4 « Continuer avec Google ».
// Implémentation maison (sans next-auth, voir README) : ne nécessite que fetch + jose, déjà utilisés
// pour la session JWT. Reste inactive tant que les trois variables GOOGLE_* ne sont pas fournies.
export async function GET() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!googleConfigure()) {
    return NextResponse.redirect(new URL("/connexion?error=google_non_configure", appUrl));
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    // Mêmes protections que le cookie de session : ce jeton est ce qui rattache le retour de Google
    // à ce navigateur-ci. « lax » est indispensable — le retour est une navigation venue d'un autre
    // site, que « strict » empêcherait d'emporter le cookie, et la comparaison échouerait toujours.
    secure: process.env.NODE_ENV === "production" && process.env.MODE_PRESENTATION !== "1",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
