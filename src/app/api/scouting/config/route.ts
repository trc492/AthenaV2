import { NextRequest, NextResponse } from "next/server";
import { readSessionToken } from "@/lib/server/auth-request";
import { verifyGuestEventLink } from "@/lib/server/event-guest";
import { loadGameConfig } from "@/lib/server/game-config-store";
import type { GameConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Read-only runtime configuration for every signed-in scouting client.
 * Clients poll this, so it checks the signed cookie rather than calling auth(),
 * which would query the database on every poll. Game configuration is not
 * sensitive enough to need a live account or guest-link revocation check.
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  const token = await readSessionToken(request);
  const guest =
    typeof token?.guestToken === "string"
      ? verifyGuestEventLink(token.guestToken)
      : null;
  if (!token || ((token.guestToken || token.role === "guest") && !guest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    let config = loadGameConfig();
    if (guest) {
      const { competitionType, year } = guest;
      const season = config[competitionType]?.[year];
      config = { FRC: {}, FTC: {} } as GameConfig;
      if (season) config[competitionType][year] = season;
    }
    return NextResponse.json({ config }, { headers });
  } catch (error) {
    console.error("Failed to load game configuration:", error);
    return NextResponse.json({ error: "Failed to load game configuration" }, { status: 500, headers });
  }
}
