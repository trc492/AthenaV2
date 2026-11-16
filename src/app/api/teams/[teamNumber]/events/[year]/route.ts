import { PERMISSIONS } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/server/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getTeamEvents } from "@/lib/api/tba";
import { getSeasonEvents } from "@/lib/api/ftcevents";
import { unstable_cache } from "next/cache";

const getCachedFrcTeamEvents = unstable_cache(
  async (teamNum: number, yearNum: number) => {
    return await getTeamEvents(teamNum, yearNum);
  },
  ["frc-team-events"],
  {
    revalidate: 60 * 60 * 24, // Cache for 1 day (86400 seconds)
    tags: ["frc-events"],
  },
);

const getCachedFtcTeamEvents = unstable_cache(
  async (teamNum: number, yearNum: number) => {
    return await getSeasonEvents(yearNum, undefined, teamNum);
  },
  ["ftc-team-events"],
  {
    revalidate: 60 * 60 * 24, // Cache for 1 day (86400 seconds)
    tags: ["ftc-events"],
  },
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamNumber: string; year: string }> },
) {
  const denied = await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  if (denied) return denied;
  try {
    const { teamNumber, year } = await params;
    const { searchParams } = new URL(request.url);
    const competitionType = searchParams.get("competitionType") || "FRC";

    if (!teamNumber || !year) {
      return NextResponse.json(
        { error: "Team number and year are required" },
        { status: 400 },
      );
    }

    const teamNum = parseInt(teamNumber);
    const yearNum = parseInt(year);

    if (isNaN(teamNum) || isNaN(yearNum)) {
      return NextResponse.json(
        { error: "Invalid team number or year" },
        { status: 400 },
      );
    }

    let events;
    if (competitionType === "FTC") {
      const response = await getCachedFtcTeamEvents(teamNum, yearNum);
      events = response.events || [];
    } else {
      // FRC
      events = await getCachedFrcTeamEvents(teamNum, yearNum);
    }

    return NextResponse.json(events, {
      headers: {
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400", // Cache for 12 hours (43200 seconds)
      },
    });
  } catch (error) {
    console.error("Error fetching team events:", error);
    return NextResponse.json(
      { error: "Failed to fetch team events" },
      { status: 500 },
    );
  }
}
