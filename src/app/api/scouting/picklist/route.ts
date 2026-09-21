import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { DatabaseService, CompetitionType } from "@/lib/types";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { calculateEPA } from "@/lib/statistics";
import { getEventRankings } from "@/lib/api/tba";
import gameConfig from "../../../../../config/game-config-loader";

// Initialize database service
let dbService: DatabaseService;

function getDbService() {
  if (!dbService) {
    dbService = databaseManager.getService();
  }
  return dbService;
}

interface TeamPicklistData {
  teamNumber: number;
  driveTrain: string;
  weight?: number;
  length?: number;
  width?: number;
  matchesPlayed: number;
  totalEPA: number;
  autoEPA: number;
  teleopEPA: number;
  endgameEPA: number;
}

// GET /api/scouting/picklist - Get ranked team list for picklist
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const picklistId = searchParams.get("picklistId");
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const eventCode = searchParams.get("eventCode");
    const competitionType =
      (searchParams.get("competitionType") as CompetitionType) || "FRC";
    const picklistType = searchParams.get("picklistType") || "main";
    const existingOnly = searchParams.get("existingOnly") === "true";

    const service = getDbService();

    // If picklistId is provided, retrieve the existing picklist with entries and notes
    if (picklistId) {
      const picklist = await service.getPicklist(parseInt(picklistId));
      if (!picklist) {
        return NextResponse.json(
          { error: "Picklist not found" },
          { status: 404 },
        );
      }

      const entries = await service.getPicklistEntries(parseInt(picklistId));

      return NextResponse.json({
        picklist,
        entries,
        success: true,
      });
    }

    // Check if there's an existing picklist for this event/year/type combination
    if (eventCode && year && picklistType) {
      try {
        const existing = await service.getPicklistByEvent(
          eventCode,
          year,
          competitionType,
          picklistType,
        );
        if (existing && existing.id) {
          const entries = await service.getPicklistEntries(existing.id);
          return NextResponse.json({
            picklist: existing,
            entries,
            success: true,
          });
        }

        if (existingOnly) {
          return NextResponse.json({
            picklist: null,
            entries: [],
            success: true,
          });
        }
      } catch (error) {
        console.error("Error fetching existing picklist by event:", error);
        if (existingOnly) {
          return NextResponse.json(
            { error: "Failed to fetch existing picklist" },
            { status: 500 },
          );
        }
        // Continue to generate rankings if no existing picklist found
      }
    }

    // Otherwise, generate initial rankings from TBA qual rankings (FRC) or EPA data (FTC/fallback)
    const pitEntries = await service.getAllPitEntries(
      year,
      undefined,
      competitionType,
    );
    const matchEntries = await service.getAllMatchEntries(
      year,
      undefined,
      competitionType,
    );

    // Filter by event if specified
    const filteredPitEntries = eventCode
      ? pitEntries.filter((entry) => entry.eventCode === eventCode)
      : pitEntries;
    const filteredMatchEntries = eventCode
      ? matchEntries.filter((entry) => entry.eventCode === eventCode)
      : matchEntries;

    // Try to use TBA rankings for FRC events
    if (eventCode && competitionType === "FRC") {
      try {
        const tbaRankings = await getEventRankings(eventCode);
        if (
          tbaRankings &&
          Array.isArray(tbaRankings) &&
          tbaRankings.length > 0
        ) {
          const rankingBlock = tbaRankings[0];
          const rankingItems = rankingBlock?.rankings || [];

          if (rankingItems.length > 0) {
            // Build team data from TBA rankings, merge with local scouting data
            const teamMap: Record<number, TeamPicklistData> = {};

            rankingItems.forEach((item) => {
              const teamNumber = parseInt(
                String(item.team_key).replace(/^frc/i, ""),
                10,
              );
              teamMap[teamNumber] = {
                teamNumber,
                driveTrain: "Unknown",
                weight: undefined,
                length: undefined,
                width: undefined,
                matchesPlayed: item.matches_played || 0,
                totalEPA: 0,
                autoEPA: 0,
                teleopEPA: 0,
                endgameEPA: 0,
              };
            });

            // Merge pit scouting data
            filteredPitEntries.forEach((pit) => {
              if (teamMap[pit.teamNumber]) {
                teamMap[pit.teamNumber].driveTrain = pit.driveTrain;
                teamMap[pit.teamNumber].weight = pit.weight ?? undefined;
                teamMap[pit.teamNumber].length = pit.length ?? undefined;
                teamMap[pit.teamNumber].width = pit.width ?? undefined;
              }
            });

            // Calculate EPA from local match entries when available
            Object.keys(teamMap).forEach((teamKey) => {
              const teamNumber = parseInt(teamKey, 10);
              const teamMatches = filteredMatchEntries.filter(
                (m) => m.teamNumber === teamNumber,
              );

              if (
                teamMatches.length > 0 &&
                year &&
                gameConfig[competitionType] &&
                gameConfig[competitionType][year.toString()]
              ) {
                try {
                  const yearConfig =
                    gameConfig[competitionType][year.toString()];
                  const epaBreakdown = calculateEPA(
                    teamMatches,
                    year,
                    yearConfig,
                  );
                  teamMap[teamNumber].autoEPA = epaBreakdown.auto;
                  teamMap[teamNumber].teleopEPA = epaBreakdown.teleop;
                  teamMap[teamNumber].endgameEPA = epaBreakdown.endgame;
                  teamMap[teamNumber].totalEPA = epaBreakdown.totalEPA;
                } catch (error) {
                  console.error(
                    `Error calculating EPA for team ${teamNumber}:`,
                    error,
                  );
                }
              }
            });

            const picklistData = rankingItems.map(
              (item, index: number) => {
                const teamNumber = parseInt(
                  String(item.team_key).replace(/^frc/i, ""),
                  10,
                );
                const td = teamMap[teamNumber] || {
                  teamNumber,
                  driveTrain: "Unknown",
                  weight: undefined,
                  length: undefined,
                  width: undefined,
                  matchesPlayed: 0,
                  totalEPA: 0,
                  autoEPA: 0,
                  teleopEPA: 0,
                  endgameEPA: 0,
                };
                return {
                  ...td,
                  rank: item.rank ?? index + 1,
                };
              },
            );

            return NextResponse.json({
              teams: picklistData,
              totalTeams: picklistData.length,
              source: "tba",
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        console.warn(
          "TBA rankings unavailable, falling back to local EPA calculation:",
          error,
        );
      }
    }

    // Fallback: Calculate rankings from local scouting data using EPA
    const teamData: Record<number, TeamPicklistData> = {};

    // Process pit scouting data
    filteredPitEntries.forEach((pit) => {
      if (!teamData[pit.teamNumber]) {
        teamData[pit.teamNumber] = {
          teamNumber: pit.teamNumber,
          driveTrain: pit.driveTrain,
          weight: pit.weight ?? undefined,
          length: pit.length ?? undefined,
          width: pit.width ?? undefined,
          matchesPlayed: 0,
          totalEPA: 0,
          autoEPA: 0,
          teleopEPA: 0,
          endgameEPA: 0,
        };
      }
    });

    // Process match data
    filteredMatchEntries.forEach((match) => {
      if (!teamData[match.teamNumber]) {
        teamData[match.teamNumber] = {
          teamNumber: match.teamNumber,
          driveTrain: "Unknown",
          weight: 0,
          length: 0,
          width: 0,
          matchesPlayed: 0,
          totalEPA: 0,
          autoEPA: 0,
          teleopEPA: 0,
          endgameEPA: 0,
        };
      }

      teamData[match.teamNumber].matchesPlayed += 1;
    });

    // Calculate EPA using proper statistics functions
    Object.keys(teamData).forEach((teamNumberStr) => {
      const teamNumber = parseInt(teamNumberStr);
      const teamMatches = filteredMatchEntries.filter(
        (entry) => entry.teamNumber === teamNumber,
      );

      if (
        teamMatches.length > 0 &&
        year &&
        gameConfig[competitionType] &&
        gameConfig[competitionType][year.toString()]
      ) {
        try {
          const yearConfig = gameConfig[competitionType][year.toString()];
          const epaBreakdown = calculateEPA(teamMatches, year, yearConfig);

          teamData[teamNumber].autoEPA = epaBreakdown.auto;
          teamData[teamNumber].teleopEPA = epaBreakdown.teleop;
          teamData[teamNumber].endgameEPA = epaBreakdown.endgame;
          teamData[teamNumber].totalEPA = epaBreakdown.totalEPA;
        } catch (error) {
          console.error(`Error calculating EPA for team ${teamNumber}:`, error);
          // Fallback to simple calculation
          let totalEPA = 0;
          teamMatches.forEach((match) => {
            if (match.gameSpecificData) {
              Object.values(match.gameSpecificData).forEach((value) => {
                if (typeof value === "number") {
                  totalEPA += value;
                }
              });
            }
          });
          teamData[teamNumber].totalEPA = totalEPA;
        }
      } else {
        // Fallback to simple calculation if no year config
        let totalEPA = 0;
        teamMatches.forEach((match) => {
          if (match.gameSpecificData) {
            Object.values(match.gameSpecificData).forEach((value) => {
              if (typeof value === "number") {
                totalEPA += value;
              }
            });
          }
        });
        teamData[teamNumber].totalEPA = totalEPA;
      }
    });

    // Convert to array and sort by EPA
    const picklistData = Object.values(teamData)
      .sort(
        (a: TeamPicklistData, b: TeamPicklistData) => b.totalEPA - a.totalEPA,
      )
      .map((team: TeamPicklistData, index: number) => ({
        ...team,
        rank: index + 1,
      }));

    return NextResponse.json({
      teams: picklistData,
      totalTeams: picklistData.length,
      source: "scouting",
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching picklist data:", error);
    return NextResponse.json(
      { error: "Failed to fetch picklist data" },
      { status: 500 },
    );
  }
}

// POST /api/scouting/picklist - Create a new picklist
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { eventCode, year, competitionType, picklistType, entries } = body;

    if (!eventCode || !year || !competitionType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const service = getDbService();

    // Create the picklist
    const picklistId = await service.addPicklist({
      eventCode,
      year,
      competitionType,
      picklistType: picklistType || "main",
    });

    // Add entries if provided
    if (entries && Array.isArray(entries) && entries.length > 0) {
      for (const entry of entries) {
        await service.addPicklistEntry({
          picklistId,
          teamNumber: entry.teamNumber,
          rank: entry.rank,
        });
      }
    }

    return NextResponse.json({
      success: true,
      id: picklistId,
      message: "Picklist created successfully",
    });
  } catch (error) {
    console.error("Error creating picklist:", error);
    return NextResponse.json(
      { error: "Failed to create picklist" },
      { status: 500 },
    );
  }
}

// PUT /api/scouting/picklist - Update picklist entry order
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { picklistId, entries } = body;

    if (!picklistId || !entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const service = getDbService();

    // Update the order of entries
    await service.reorderPicklistEntries(parseInt(picklistId), entries);

    return NextResponse.json({
      success: true,
      message: "Picklist order updated successfully",
    });
  } catch (error) {
    console.error("Error updating picklist order:", error);
    return NextResponse.json(
      { error: "Failed to update picklist order" },
      { status: 500 },
    );
  }
}

// DELETE /api/scouting/picklist - Delete a picklist
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const picklistId = searchParams.get("picklistId");

    if (!picklistId) {
      return NextResponse.json(
        { error: "Missing picklistId" },
        { status: 400 },
      );
    }

    const service = getDbService();
    await service.deletePicklist(parseInt(picklistId));

    return NextResponse.json({
      success: true,
      message: "Picklist deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting picklist:", error);
    return NextResponse.json(
      { error: "Failed to delete picklist" },
      { status: 500 },
    );
  }
}
