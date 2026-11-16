import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_REQUESTS = 20;

export async function POST(request: NextRequest) {
  try {
    // Share the sign-in budget so this endpoint is not a second set of guesses.
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const rateLimit = checkRateLimit(request, {
      keyPrefix: "login",
      windowMs: LOGIN_WINDOW_MS,
      maxRequests: LOGIN_MAX_REQUESTS,
      subject: username.trim()
        ? `user:${username.trim().toLowerCase().slice(0, 64)}`
        : undefined,
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

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 },
      );
    }

    const db = databaseManager.getService();
    if (!db.users) {
      return NextResponse.json(
        { error: "User management is not supported by this database provider" },
        { status: 500 },
      );
    }
    const user = await db.users.getByUsername(username);
    if (!user || user.deactivatedAt) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }
    const passwordHash = String(user.password_hash || "");

    if (!passwordHash) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      id: user.id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    console.error("Auth API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
