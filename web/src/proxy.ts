import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "nzilabiz_session";

// Pages d'authentification : accessibles sans compte, mais un utilisateur déjà connecté n'a rien à
// y faire — on le renvoie vers son tableau de bord.
const AUTH_PATHS = ["/connexion", "/inscription", "/mot-de-passe-oublie"];

// Pages ouvertes à tout le monde, connecté ou non : la vitrine et les documents légaux. Elles ne
// doivent jamais rediriger, sinon un utilisateur connecté ne pourrait pas relire les conditions
// depuis ses paramètres.
// L'invitation d'un employé fait partie des pages ouvertes : celui qui scanne le QR code n'a pas
// encore de compte, et un patron déjà connecté doit pouvoir vérifier le lien qu'il vient de créer.
// La réinitialisation de mot de passe est ouverte à tous, y compris à quelqu'un déjà connecté :
// c'est précisément le cas de la personne qui découvre une session ouverte sur un appareil qu'elle
// ne reconnaît pas et veut reprendre la main. La classer parmi les pages d'authentification la
// renverrait vers le tableau de bord, et le lien reçu par e-mail resterait sans effet.
// La confirmation d'adresse e-mail relève du même raisonnement que la réinitialisation, et pour la
// même raison : le lien arrive par courrier électronique et doit aboutir dans tous les cas. Sans
// cette ligne, le middleware renvoyait vers /connexion — un commerçant qui cliquait son lien de
// confirmation atterrissait sur la page de connexion et son adresse ne se vérifiait jamais.
const OPEN_PATHS = [
  "/conditions",
  "/confidentialite",
  "/cookies",
  "/mentions-legales",
  "/invitation/",
  "/testeur/",
  "/reinitialiser/",
  "/verifier-email/",
];

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
    // Épinglé à HS256, l'algorithme utilisé par createSessionToken (src/lib/auth/session.ts) :
    // défense en profondeur, la clé symétrique excluant déjà `alg: none` et toute confusion
    // RS256/HS256 côté jose.
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
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
