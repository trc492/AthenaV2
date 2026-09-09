import { NextRequest, NextResponse } from "next/server";
import { loadAppConfig, saveAppConfig } from "@/lib/server/env-file";
import { databaseManager } from "@/db/database-manager";

/**
 * POST /api/setup/app-url
 *
 * Validates and persists the canonical public URL for this deployment
 * to .runtime/app-config.json. next.config.ts reads this file on startup
 * and injects it as NEXTAUTH_URL so NextAuth callback URLs are correct
 * when running behind a reverse proxy.
 *
 * Only callable during the setup wizard (before the database is configured),
 * or when app-config.json doesn't already exist — after that the value can
 * be changed from the Settings page.
 */
export async function POST(request: NextRequest) {
  try {
    // If the app is already fully set up (DB configured + admin exists),
    // this endpoint shouldn't be called during setup again.
    // We still allow it — settings changes can re-POST here.
    // Block only if app-config already exists AND setup is complete.
    const existing = loadAppConfig();
    const dbConfigured = databaseManager.isConfigured();

    // If setup is complete and a URL is already saved, reject to avoid
    // accidental overwrites via the setup wizard path. Settings page can
    // update this through a separate authenticated endpoint later.
    if (existing && dbConfigured) {
      return NextResponse.json(
        { error: "App URL is already configured. Update it from Settings." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const raw: unknown = body?.appUrl;

    if (typeof raw !== "string" || raw.trim().length === 0) {
      return NextResponse.json(
        { error: "appUrl is required." },
        { status: 400 },
      );
    }

    const appUrl = raw.trim().replace(/\/+$/, ""); // strip trailing slashes

    // Basic URL validation — must be http:// or https://
    let parsed: URL;
    try {
      parsed = new URL(appUrl);
    } catch {
      return NextResponse.json(
        { error: "appUrl must be a valid URL (e.g. https://scouting.myteam.com)." },
        { status: 400 },
      );
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "appUrl must use http or https." },
        { status: 400 },
      );
    }

    await saveAppConfig({ appUrl });

    return NextResponse.json({
      success: true,
      appUrl,
    });
  } catch (error) {
    console.error("[setup/app-url] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save app URL.",
      },
      { status: 500 },
    );
  }
}
