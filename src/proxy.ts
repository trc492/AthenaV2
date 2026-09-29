import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { withAuthOrigin } from "@/lib/server/auth-request";
export default async function middleware(req: NextRequest) {
  const publicRequest = withAuthOrigin(req);
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: publicRequest.nextUrl.protocol === "https:",
  });
  const isAuth = !!token;
  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/signup");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isApiRegister = req.nextUrl.pathname.startsWith("/api/auth/register");
  const isHomePage = req.nextUrl.pathname === "/";
  const isSetupPage = req.nextUrl.pathname.startsWith("/setup");
  const isSetupApi = new Set([
    "/api/setup/app-url",
    "/api/setup/database",
    "/api/setup/admin",
  ]).has(req.nextUrl.pathname);
  const isSEO =
    req.nextUrl.pathname === "/robots.txt" ||
    req.nextUrl.pathname === "/sitemap.xml";
  const isAsset = req.nextUrl.pathname.startsWith("/_next/static") || req.nextUrl.pathname.startsWith("/assets");

  // Always allow authentication pages: an unexpired JWT can belong to a
  // deleted account. Only auth() can validate the current database account;
  // redirecting here based on the cookie alone can trap it in a login loop.

  // The home page performs its own setup check before redirecting an active
  // session, so first-run installations still reach the setup wizard.
  if (
    isAuthPage ||
    isSetupPage ||
    isSetupApi ||
    isApiAuth ||
    isApiRegister ||
    isHomePage ||
    isSEO ||
    isAsset
  ) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isAuth) {
    return NextResponse.redirect(new URL("/login", publicRequest.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
