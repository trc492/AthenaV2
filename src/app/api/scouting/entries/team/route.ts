import { guestDatabase } from "@/lib/server/guest-database";
import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { DatabaseService, MatchEntry, CompetitionType } from "@/lib/types";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { calculateEPA, calculateTeamStats } from "@/lib/statistics";
import gameConfig from "../../../../../../config/game-config-loader";

// Resolve the active provider on each request so configuration changes take effect.
function getDbService(): DatabaseService {
  return databaseManager.getService();
}

// GET /api/scouting/entries/team - Get team data for a specific team
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_PIT_SCOUTING)
    ) {
      // allow match-only view if they have match scouting permission
      if (
        !session?.user?.role ||
        !hasPermission(session.user.role, PERMISSIONS.VIEW_MATCH_SCOUTING)
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    const { searchParams } = new URL(request.url);
    const teamNumber = searchParams.get("teamNumber");
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const eventCode = searchParams.get("eventCode");
    const competitionType =
      (searchParams.get("competitionType") as CompetitionType) || "FRC";

    if (!teamNumber) {
      return NextResponse.json(
        { error: "Team number is required" },
        { status: 400 },
      );
    }

    const service = guestDatabase(getDbService(), session);

    // Get match entries for the team, filtered by competition type
    const matchEntries = await service.getMatchEntries(
      parseInt(teamNumber),
      year,
      competitionType,
    );

    // Filter by event if specified
    const filteredMatchEntries = eventCode
      ? matchEntries.filter(
          (entry: MatchEntry) => entry.eventCode === eventCode,
        )
      : matchEntries;

    // Get pit entry for the team, filtered by competition type
    const definedYear =
      year ||
      (competitionType == "FRC"
        ? new Date().getFullYear()
        : new Date().getFullYear() + 1);
    const pitEntry = await service.getPitEntry(
      parseInt(teamNumber),
      definedYear,
      competitionType,
    );

    // Calculate statistics if we have match data
    let teamStats = null;
    let epaBreakdown = null;

    if (
      filteredMatchEntries.length > 0 &&
      year &&
      gameConfig[competitionType] &&
      gameConfig[competitionType][year.toString()]
    ) {
      try {
        const yearConfig = gameConfig[competitionType][year.toString()];
        teamStats = calculateTeamStats(filteredMatchEntries, year, yearConfig);
        epaBreakdown = calculateEPA(filteredMatchEntries, year, yearConfig);
      } catch (error) {
        console.error(
          `Error calculating team stats for team ${teamNumber}:`,
          error,
        );
      }
    }

    // Round all numeric values to 3 decimal places
    const roundValue = (value: number) => parseFloat(value.toFixed(3));

    const responseData = {
      teamNumber: parseInt(teamNumber),
      year,
      eventCode,
      matchEntries: filteredMatchEntries,
      pitEntry,
      stats: teamStats
        ? {
            ...teamStats,
            // Round all values in teamStats
            avgScore: roundValue(teamStats.avgScore || 0),
            epa: roundValue(teamStats.epa || 0),
          }
        : null,
      epa: epaBreakdown
        ? {
            autoEPA: roundValue(epaBreakdown.auto),
            teleopEPA: roundValue(epaBreakdown.teleop),
            endgameEPA: roundValue(epaBreakdown.endgame),
            penaltiesEPA: roundValue(epaBreakdown.penalties),
            totalEPA: roundValue(epaBreakdown.totalEPA),
          }
        : null,
      matchCount: filteredMatchEntries.length,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error fetching team data:", error);
    return NextResponse.json(
      { error: "Failed to fetch team data" },
      { status: 500 },
    );
  }
}
