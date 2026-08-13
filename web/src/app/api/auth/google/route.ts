import { NextResponse } from "next/server";

// Démarre le flux OAuth2 "Authorization Code" de Google — §4 "Continuer avec Google".
// Implémentation maison (sans next-auth, voir README) : ne nécessite que fetch + jose, déjà utilisés
// pour la session JWT. Reste inactif tant que GOOGLE_CLIENT_ID/SECRET ne sont pas fournis (§ README
// "Bloqué cette nuit").
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      new URL("/connexion?error=google_non_configure", process.env.APP_URL ?? "http://localhost:3000")
    );
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set("nzilabiz_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
