import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth/config";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_REQUESTS = 20;

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  // Credentials sign-in requests go through this callback route.
  if (request.nextUrl.pathname.includes("/callback/credentials")) {
    const rateLimit = checkRateLimit(request, {
      keyPrefix: "login-callback",
      windowMs: LOGIN_WINDOW_MS,
      maxRequests: LOGIN_MAX_REQUESTS,
    });

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit, LOGIN_MAX_REQUESTS),
        },
      );
    }
  }

  return handlers.POST(request);
}
