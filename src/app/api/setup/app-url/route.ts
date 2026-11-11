import { requireSetupToken, withSetupLock } from "@/lib/server/setup-access";
import { NextRequest, NextResponse } from "next/server";
import { loadAppConfig, saveAppConfig } from "@/lib/server/env-file";
import { databaseManager } from "@/db/database-manager";

/** Save the initial canonical public origin using the deployment setup token. */
export async function POST(request: NextRequest) {
  const denied = requireSetupToken(request);
  if (denied) return denied;
  return withSetupLock(() => handlePost(request));
}

async function handlePost(request: NextRequest) {
  try {
    const existing = loadAppConfig();
    const dbConfigured = databaseManager.isConfigured();

    if (existing && dbConfigured) {
      return NextResponse.json(
        { error: "App URL is already configured. Ask the host to update AUTH_URL or NEXTAUTH_URL." },
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
        {
          error:
            "appUrl must be a valid URL (e.g. https://scouting.myteam.com).",
        },
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
          error instanceof Error ? error.message : "Failed to save app URL.",
      },
      { status: 500 },
    );
  }
}
