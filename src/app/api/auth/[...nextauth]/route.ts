import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth/config";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { withAuthOrigin } from "@/lib/server/auth-request";

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_REQUESTS = 20;
// Ceiling across all accounts when callers cannot be told apart by IP.
const LOGIN_MAX_REQUESTS_TOTAL = 300;

/** The account (or guest link) a sign-in attempt targets, if readable. */
async function loginSubject(request: NextRequest): Promise<string | undefined> {
  try {
    const form = await request.clone().formData();
    if (form.get("guestToken")) return "guest-link";
    const username = form.get("username");
    return typeof username === "string" && username.trim()
      ? `user:${username.trim().toLowerCase().slice(0, 64)}`
      : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(request: NextRequest) {
  return handlers.GET(withAuthOrigin(request));
}

export async function POST(request: NextRequest) {
  // Credentials sign-in requests go through this callback route.
  if (request.nextUrl.pathname.includes("/callback/credentials")) {
    const total = checkRateLimit(request, {
      keyPrefix: "login-total",
      windowMs: LOGIN_WINDOW_MS,
      maxRequests: LOGIN_MAX_REQUESTS_TOTAL,
    });
    const perAccount = checkRateLimit(request, {
      keyPrefix: "login",
      windowMs: LOGIN_WINDOW_MS,
      maxRequests: LOGIN_MAX_REQUESTS,
      subject: await loginSubject(request),
    });
    const rateLimit = total.limited ? total : perAccount;

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

  return handlers.POST(withAuthOrigin(request));
}
