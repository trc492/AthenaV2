import { NextRequest, NextResponse } from "next/server";
import { DatabaseManager } from "@/db/database-manager";
import { CompetitionType } from "@/lib/types";
import { calculateEPA } from "@/lib/statistics";
import gameConfig from "../../../../../../config/game-config-loader";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";

// Get database service from manager
function getDbService() {
  return DatabaseManager.getInstance().getService();
}

// GET /api/scouting/analysis/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_DASHBOARD)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const eventCode = searchParams.get("eventCode") || undefined;
    const competitionType =
      (searchParams.get("competitionType") as CompetitionType) || "FRC";

    const service = getDbService();

    const pitEntries = await service.getAllPitEntries(
      year,
      eventCode,
      competitionType,
    );

    const matchEntries = await service.getAllMatchEntries(
      year,
      eventCode,
      competitionType,
    );

    // Calculate statistics
    const uniqueTeams = new Set([
      ...pitEntries.map((entry) => entry.teamNumber),
      ...matchEntries.map((entry) => entry.teamNumber),
    ]);
    const uniqueMatches = new Set(
      matchEntries.map((entry) => entry.matchNumber),
    ).size;
    const totalMatches = matchEntries.length;
    const totalPitScouts = pitEntries.length;
    const uniqueTeamCount = uniqueTeams.size;

    // Calculate match completion (6 or 4 teams per match)
    const teamsPerMatch = competitionType === "FRC" ? 6 : 4;
    const matchCompletion =
      uniqueMatches > 0
        ? (totalMatches / (uniqueMatches * teamsPerMatch)) * 100
        : 0;

    // Calculate EPA-like metrics using proper EPA calculation
    const teamStats = Array.from(uniqueTeams).map((teamNumber) => {
      const teamMatches = matchEntries.filter(
        (entry) => entry.teamNumber === teamNumber,
      );
      const teamPit = pitEntries.find(
        (entry) => entry.teamNumber === teamNumber,
      );

      let totalEPA = 0;

      if (
        teamMatches.length > 0 &&
        year &&
        gameConfig[competitionType] &&
        gameConfig[competitionType][year.toString()]
      ) {
        try {
          const yearConfig = gameConfig[competitionType][year.toString()];
          const epaBreakdown = calculateEPA(teamMatches, year, yearConfig);
          totalEPA = epaBreakdown.totalEPA;
        } catch (error) {
          console.error(`Error calculating EPA for team ${teamNumber}:`, error);
          // Fallback to simple sum of numeric game-specific data fields
          teamMatches.forEach((match) => {
            if (match.gameSpecificData) {
              Object.values(match.gameSpecificData).forEach((value) => {
                if (typeof value === "number") totalEPA += value;
              });
            }
          });
        }
      } else {
        // Fallback when no year config is available
        teamMatches.forEach((match) => {
          if (match.gameSpecificData) {
            Object.values(match.gameSpecificData).forEach((value) => {
              if (typeof value === "number") totalEPA += value;
            });
          }
        });
      }

      return {
        teamNumber,
        // Older pit documents may carry a team name; the schema does not.
        name:
          (teamPit as { name?: string } | undefined)?.name ||
          `Team ${teamNumber}`,
        matchesPlayed: teamMatches.length,
        totalEPA: isNaN(totalEPA) ? 0 : totalEPA,
      };
    });

    // Sort by EPA descending for ranking
    teamStats.sort((a, b) => b.totalEPA - a.totalEPA);

    const stats = {
      totalTeams: uniqueTeamCount,
      uniqueMatches,
      totalMatches,
      totalPitScouts,
      matchCompletion: Math.round(matchCompletion),
      teamStats,
      recentActivity: matchEntries
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 5)
        .map((entry) => ({
          teamNumber: entry.teamNumber,
          matchNumber: entry.matchNumber,
          timestamp: entry.timestamp,
        })),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    );
  }
}
