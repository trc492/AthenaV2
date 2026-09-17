import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";

// NOTE: This route exists for compatibility with build-time tooling/tests that import it.
// Schedule persistence is handled via the `matchAssignments` table, but the UI uses
// `/api/scouting/schedule/*` routes.

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role ?? null, PERMISSIONS.VIEW_SCHEDULE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventCode = searchParams.get("eventCode");
    const yearRaw = searchParams.get("year");
    const competitionType = searchParams.get("competitionType");

    if (!eventCode || !yearRaw || !["FRC", "FTC"].includes(competitionType ?? "")) {
      return NextResponse.json(
        { error: "eventCode, year, and competitionType are required" },
        { status: 400 },
      );
    }

    const year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 1992 || year > 2100) {
      return NextResponse.json(
        { error: "year must be an integer between 1992 and 2100" },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();
    if (!service.query) {
      return NextResponse.json(
        { error: "Schedule assignments require a SQL-backed provider" },
        { status: 501 },
      );
    }

    const result = await service.query<{
      eventCode: string;
      year: number;
      matchNumber: number;
      alliance: string;
      position: number;
      userId: string | null;
    }>(`
        SELECT eventCode, year, matchNumber, alliance, position, userId
        FROM matchAssignments
        WHERE eventCode = @eventCode AND year = @year
          AND competitionType = @competitionType
        ORDER BY matchNumber, alliance, position
      `, { eventCode, year, competitionType });

    return NextResponse.json(result.recordset, {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (error) {
    console.error("Error fetching match assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch match assignments" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !hasPermission(session.user.role ?? null, PERMISSIONS.DELETE_SCHEDULE)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventCode = searchParams.get("eventCode");
    const yearRaw = searchParams.get("year");
    const competitionType = searchParams.get("competitionType");

    if (!eventCode || !yearRaw || !["FRC", "FTC"].includes(competitionType ?? "")) {
      return NextResponse.json(
        { error: "eventCode, year, and competitionType are required" },
        { status: 400 },
      );
    }

    const year = Number(yearRaw);
    if (!Number.isInteger(year) || year < 1992 || year > 2100) {
      return NextResponse.json(
        { error: "year must be an integer between 1992 and 2100" },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();
    if (!service.applyScheduleAssignmentChanges) {
      return NextResponse.json(
        { error: "Schedule assignments require a SQL-backed provider" },
        { status: 501 },
      );
    }
    await service.applyScheduleAssignmentChanges(
      { eventCode, year, competitionType: competitionType as "FRC" | "FTC" },
      [],
      true,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting match assignments:", error);
    return NextResponse.json(
      { error: "Failed to delete match assignments" },
      { status: 500 },
    );
  }
}
