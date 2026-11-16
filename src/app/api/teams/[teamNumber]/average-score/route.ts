import { PERMISSIONS } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/server/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getTeamMatchesForEvent as getFrcTeamMatches } from "@/lib/api/tba";
import { getEventMatches as getFtcEventMatches } from "@/lib/api/ftcevents";
import type { TbaMatchSimple } from "@/lib/api/tba-types";

/**
 * GET /api/teams/[teamNumber]/average-score
 * Returns the average score for a team from official match data (TBA for FRC, FIRST Events API for FTC)
 *
 * Query parameters:
 * - year: The season year (required)
 * - eventCode: The event code (required)
 * - competitionType: 'FRC' or 'FTC' (required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamNumber: string }> },
) {
  const denied = await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  if (denied) return denied;
  try {
    const { teamNumber: teamNumberStr } = await params;
    const teamNumber = parseInt(teamNumberStr);
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const eventCode = searchParams.get("eventCode");
    const competitionType = searchParams.get("competitionType") || "FRC";

    if (!year || !eventCode) {
      return NextResponse.json(
        { error: "Year and eventCode are required" },
        { status: 400 },
      );
    }

    const yearNum = parseInt(year);

    if (competitionType === "FRC") {
      // Fetch FRC matches from The Blue Alliance
      const matches = await getFrcTeamMatches(teamNumber, eventCode);

      // Filter only qualification matches and calculate average score
      const qualMatches = matches.filter(
        (match: TbaMatchSimple) => match.comp_level === "qm",
      );

      if (qualMatches.length === 0) {
        return NextResponse.json({ averageScore: 0, matchCount: 0 });
      }

      let totalScore = 0;
      let validMatchCount = 0;

      for (const match of qualMatches) {
        // Determine which alliance the team was on
        const isRedAlliance = match.alliances.red.team_keys.some(
          (key: string) => key === `frc${teamNumber}`,
        );
        const isBlueAlliance = match.alliances.blue.team_keys.some(
          (key: string) => key === `frc${teamNumber}`,
        );

        if (isRedAlliance && match.alliances.red.score >= 0) {
          totalScore += match.alliances.red.score;
          validMatchCount++;
        } else if (isBlueAlliance && match.alliances.blue.score >= 0) {
          totalScore += match.alliances.blue.score;
          validMatchCount++;
        }
      }

      const averageScore =
        validMatchCount > 0 ? totalScore / validMatchCount : 0;

      return NextResponse.json({
        averageScore: parseFloat(averageScore.toFixed(2)),
        matchCount: validMatchCount,
      });
    } else if (competitionType === "FTC") {
      // Fetch FTC matches from FIRST Events API
      const matchesResponse = await getFtcEventMatches(
        yearNum,
        eventCode,
        "qual", // Tournament level - qualification matches
        teamNumber,
      );

      const matches = matchesResponse.matches || [];

      if (matches.length === 0) {
        return NextResponse.json({ averageScore: 0, matchCount: 0 });
      }

      let totalScore = 0;
      let validMatchCount = 0;

      for (const match of matches) {
        // Determine which alliance the team was on by checking the teams array
        const teamInfo = match.teams?.find(
          (t: { teamNumber: number }) => t.teamNumber === teamNumber,
        );

        if (!teamInfo) continue;

        // Station format is like "Red1", "Blue2", etc.
        const station = teamInfo.station;
        if (!station) continue;

        const isRedAlliance = station.toLowerCase().startsWith("red");
        const isBlueAlliance = station.toLowerCase().startsWith("blue");

        if (isRedAlliance && match.scoreRedFinal >= 0) {
          totalScore += match.scoreRedFinal;
          validMatchCount++;
        } else if (isBlueAlliance && match.scoreBlueFinal >= 0) {
          totalScore += match.scoreBlueFinal;
          validMatchCount++;
        }
      }

      const averageScore =
        validMatchCount > 0 ? totalScore / validMatchCount : 0;

      return NextResponse.json({
        averageScore: parseFloat(averageScore.toFixed(2)),
        matchCount: validMatchCount,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid competition type. Must be FRC or FTC" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error fetching average score:", error);
    return NextResponse.json(
      { error: "Failed to fetch average score from external API" },
      { status: 500 },
    );
  }
}
