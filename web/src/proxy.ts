import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "nzilabiz_session";

// Pages d'authentification : accessibles sans compte, mais un utilisateur déjà connecté n'a rien à
// y faire — on le renvoie vers son tableau de bord.
const AUTH_PATHS = ["/connexion", "/inscription"];

// Pages ouvertes à tout le monde, connecté ou non : la vitrine et les documents légaux. Elles ne
// doivent jamais rediriger, sinon un utilisateur connecté ne pourrait pas relire les conditions
// depuis ses paramètres.
// L'invitation d'un employé fait partie des pages ouvertes : celui qui scanne le QR code n'a pas
// encore de compte, et un patron déjà connecté doit pouvoir vérifier le lien qu'il vient de créer.
const OPEN_PATHS = ["/conditions", "/confidentialite", "/cookies", "/mentions-legales", "/invitation/", "/testeur/"];

// HSTS ne peut pas être déclaré dans `next.config.ts` : les en-têtes y sont figés au moment de la
// compilation, alors que le protocole réellement utilisé se décide au démarrage — une même version
// compilée sert aussi bien en ligne (HTTPS) qu'en présentation sur le réseau local (HTTP).
// On l'ajoute donc ici, et seulement si la requête est bien arrivée en HTTPS : c'est aussi ce
// qu'exige la RFC 6797, un navigateur devant ignorer cet en-tête reçu en clair.
function avecHsts(reponse: NextResponse, request: NextRequest): NextResponse {
  const protocole =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    request.nextUrl.protocol.replace(":", "");
  if (protocole === "https") {
    reponse.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return reponse;
}

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const authenticated = await isValidSession(token);

  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) {
    return avecHsts(NextResponse.next(), request);
  }

  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // La racine porte la vitrine publique. Un utilisateur connecté va directement au travail.
  if (pathname === "/") {
    if (!authenticated) return avecHsts(NextResponse.next(), request);
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return avecHsts(NextResponse.redirect(url), request);
  }

  if (!authenticated && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    return avecHsts(NextResponse.redirect(url), request);
  }

  if (authenticated && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return avecHsts(NextResponse.redirect(url), request);
  }

  return avecHsts(NextResponse.next(), request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|brand|manifest.json|sw.js|offline.html).*)"],
};
