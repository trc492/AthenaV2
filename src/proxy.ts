import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
export default async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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

  // Allow access to auth pages, setup pages, API routes, and home page
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
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
