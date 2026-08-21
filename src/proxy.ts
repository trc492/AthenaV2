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
  const isSetupPage =
    req.nextUrl.pathname.startsWith("/setup") ||
    req.nextUrl.pathname.startsWith("/api/setup");
  const isSEO =
    req.nextUrl.pathname === "/robots.txt" ||
    req.nextUrl.pathname === "/sitemap.xml";
  const isAsset = req.nextUrl.pathname.startsWith("/_next/static") || req.nextUrl.pathname.startsWith("/assets");

  // Allow access to auth pages, setup pages, API routes, and home page
  if (isAuthPage || isSetupPage || isApiAuth || isApiRegister || isHomePage || isSEO || isAsset) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isAuth) {
    // console.log(`Redirecting to login - no auth for path: ${req.nextUrl.pathname}`)
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // // console.log(`Allowing access to: ${req.nextUrl.pathname}`)
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
