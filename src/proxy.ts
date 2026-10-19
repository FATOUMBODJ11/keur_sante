import { NextResponse, type NextRequest } from "next/server";

/**
 * Vérification optimiste : sans cookie de session, on renvoie vers l'accueil
 * (qui contient la connexion). La vérification réelle (signature, expiration)
 * est faite par chaque route API via `requireUser()`.
 */
const PUBLIC = ["/bienvenue", "/mot-de-passe-oublie", "/reinitialiser", "/confidentialite"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((x) => pathname === x || pathname.startsWith(`${x}/`));
  if (!req.cookies.has("ks_session") && !isPublic) {
    return NextResponse.redirect(new URL("/bienvenue", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|logo.png|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
