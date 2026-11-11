import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import type { CompetitionType } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamNumber = searchParams.get("teamNumber");
    const eventCode = searchParams.get("eventCode");
    const year = searchParams.get("year");
    const competitionType = searchParams.get("competitionType");

    if (!teamNumber || !eventCode || !year || !competitionType) {
      return NextResponse.json(
        {
          error:
            "Team number, event code, year, and competition type are required",
        },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();
    const exists = await service.checkPitScoutExists(
      parseInt(teamNumber),
      eventCode,
      parseInt(year),
      competitionType as CompetitionType,
    );

    return NextResponse.json({ exists });
  } catch (error) {
    console.error("Error checking pit scout:", error);
    return NextResponse.json(
      { error: "Failed to check pit scout existence" },
      { status: 500 },
    );
  }
}
