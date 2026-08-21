import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_REQUESTS = 20;

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(request, {
      keyPrefix: "login",
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

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 },
      );
    }

    const db = databaseManager.getService();
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service does not support direct SQL queries" },
        { status: 500 },
      );
    }
    const result = await db.query<{
      id: string;
      name: string;
      username: string;
      role: string;
      password_hash: string;
      avatarUrl: string | null;
    }>(`
        SELECT id, name, username, role, password_hash, avatarUrl
        FROM users
        WHERE username = @username
      `, { username });

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const user = result.recordset[0];
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
