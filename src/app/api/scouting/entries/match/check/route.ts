import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import type { CompetitionType } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamNumber = searchParams.get("teamNumber");
    const matchNumber = searchParams.get("matchNumber");
    const eventCode = searchParams.get("eventCode");
    const year = searchParams.get("year");
    const competitionType = searchParams.get("competitionType");

    if (!teamNumber || !matchNumber || !eventCode || !year || !competitionType) {
      return NextResponse.json(
        {
          error:
            "Team number, match number, event code, year, and competition type are required",
        },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();
    const exists = await service.checkMatchScoutExists(
      parseInt(teamNumber),
      parseInt(matchNumber),
      eventCode,
      parseInt(year),
      competitionType as CompetitionType,
    );

    return NextResponse.json({ exists });
  } catch (error) {
    console.error("Error checking match scout:", error);
    return NextResponse.json(
      { error: "Failed to check match scout existence" },
      { status: 500 },
    );
  }
}
