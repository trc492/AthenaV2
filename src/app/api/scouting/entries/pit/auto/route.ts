import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { getDbService } from "@/lib/server/db-service";
import { CompetitionType } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";



// GET /api/scouting/entries/stats/auto - Get autonomous drawing for a team
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_PIT_SCOUTING)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teamNumber = searchParams.get("teamNumber")
      ? parseInt(searchParams.get("teamNumber")!)
      : undefined;
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const competitionType =
      (searchParams.get("competitionType") as CompetitionType) || undefined;

    if (!teamNumber || !year) {
      return NextResponse.json(
        { error: "teamNumber and year are required" },
        { status: 400 },
      );
    }

    const service = getDbService();
    const entry = await service.getPitEntry(teamNumber, year, competitionType);

    if (!entry) {
      return NextResponse.json({ autoDrawing: null });
    }

    return NextResponse.json({ autoDrawing: entry.autoDrawing || null });
  } catch (error) {
    console.error("Error fetching auto drawing:", error);
    return NextResponse.json(
      { error: "Failed to fetch auto drawing" },
      { status: 500 },
    );
  }
}
