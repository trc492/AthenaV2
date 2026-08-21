import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { createUser } from "@/lib/server/user-service";

const REGISTER_WINDOW_MS = 60 * 1000;
const REGISTER_MAX_REQUESTS = 20;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, {
      keyPrefix: "register",
      windowMs: REGISTER_WINDOW_MS,
      maxRequests: REGISTER_MAX_REQUESTS,
    });

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: "Too many account creation attempts. Please try again later.",
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit, REGISTER_MAX_REQUESTS),
        },
      );
    }

    const { name, username, password } = await request.json();

    const result = await createUser({
      name,
      username,
      password,
      role: "scout",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { message: "User created successfully", userId: result.userId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
