import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { withAuthOrigin } from "@/lib/server/auth-request";
import { resolveGuestEventLink } from "@/lib/server/guest-link-service";
import {
  isGuestPage,
  scopeGuestApi,
  isGuestAuthRequest,
} from "@/lib/auth/guest-policy";
export default async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/guest/events/")) {
    // The guest page verifies its signed grant before reading any data.
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("X-Athena-Guest", "1");
    return response;
  }
  const publicRequest = withAuthOrigin(req);
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: publicRequest.nextUrl.protocol === "https:",
  });
  if (token?.guestToken || token?.role === "guest") {
    const grant =
      typeof token.guestToken === "string"
        ? await resolveGuestEventLink(token.guestToken)
        : null;
    const path = req.nextUrl.pathname;
    const noStore = (response: NextResponse) => {
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      response.headers.set("X-Athena-Guest", "1");
      return response;
    };
    if (isGuestAuthRequest(path, req.method))
      return noStore(NextResponse.next());
    if (!grant)
      return noStore(
        path.startsWith("/api/")
          ? NextResponse.json(
              { error: "Guest access expired" },
              { status: 401 },
            )
          : NextResponse.redirect(new URL("/login", publicRequest.url)),
      );
    if (req.method !== "GET" && req.method !== "HEAD")
      return noStore(
        NextResponse.json(
          { error: "Guest access is read-only" },
          { status: 403 },
        ),
      );
    if (path.startsWith("/api/")) {
      const scoped = scopeGuestApi(new URL(req.url), grant);
      if (!scoped)
        return noStore(
          NextResponse.json(
            { error: "Unavailable with guest access" },
            { status: 403 },
          ),
        );
      return noStore(NextResponse.rewrite(scoped));
    }
    if (
      isGuestPage(path) ||
      path === "/login" ||
      path.startsWith("/serwist/") ||
      path.startsWith("/_next/") ||
      path.startsWith("/assets/")
    )
      return noStore(NextResponse.next());
    return noStore(
      NextResponse.redirect(new URL("/dashboard", publicRequest.url)),
    );
  }
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
  const isAsset =
    req.nextUrl.pathname.startsWith("/_next/static") ||
    req.nextUrl.pathname.startsWith("/assets");

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
