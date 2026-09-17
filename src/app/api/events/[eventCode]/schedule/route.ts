import { NextRequest, NextResponse } from "next/server";
import { getEventMatches as getTbaEventMatches } from "@/lib/api/tba";
import {
  getEventSchedule as getFtcEventSchedule,
  getEventMatches as getFtcEventMatches,
} from "@/lib/api/ftcevents";
import { TbaMatch } from "@/lib/api/tba-types";
import {
  FtcScheduledMatch,
  FtcScheduledMatchTeam,
  FtcMatchResult,
  FtcMatchResultTeam,
} from "@/lib/api/ftcevents-types";
import { parseEventRequest } from "@/lib/server/event-request";

// Unified match schedule response format
export interface MatchScheduleTeam {
  teamNumber: number;
  alliance: "red" | "blue";
  position: number; // 1, 2, or 3 for FRC; 1 or 2 for FTC
}

export interface MatchScheduleEntry {
  matchNumber: number;
  compLevel: string;
  teams: MatchScheduleTeam[];
  startTime?: string | null;
}

export interface MatchScheduleResponse {
  matches: MatchScheduleEntry[];
  competitionType: "FRC" | "FTC";
}

function parseTbaMatches(matches: TbaMatch[]): MatchScheduleEntry[] {
  return matches
    .filter((m) => m.comp_level === "qm") // Only qualification matches for auto-assign
    .map((m) => {
      const teams: MatchScheduleTeam[] = [];

      // Parse red alliance teams
      m.alliances.red.team_keys.forEach((key, index) => {
        const teamNumber = parseInt(key.replace("frc", ""));
        if (!isNaN(teamNumber)) {
          teams.push({
            teamNumber,
            alliance: "red",
            position: index + 1,
          });
        }
      });

      // Parse blue alliance teams
      m.alliances.blue.team_keys.forEach((key, index) => {
        const teamNumber = parseInt(key.replace("frc", ""));
        if (!isNaN(teamNumber)) {
          teams.push({
            teamNumber,
            alliance: "blue",
            position: index + 1,
          });
        }
      });

      return {
        matchNumber: m.match_number,
        compLevel: m.comp_level,
        teams,
        startTime: m.time ? new Date(m.time * 1000).toISOString() : null,
      };
    })
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

function parseFtcSchedule(schedule: FtcScheduledMatch[]): MatchScheduleEntry[] {
  return schedule
    .filter((m) => m.tournamentLevel === "QUALIFICATION")
    .map((m) => {
      const teams: MatchScheduleTeam[] = [];

      if (m.teams) {
        m.teams.forEach((team: FtcScheduledMatchTeam) => {
          if (team.teamNumber !== null && team.station) {
            // FTC station format: "Red1", "Red2", "Blue1", "Blue2"
            const isRed = team.station.toLowerCase().startsWith("red");
            const position = parseInt(team.station.replace(/\D/g, "")) || 1;

            teams.push({
              teamNumber: team.teamNumber,
              alliance: isRed ? "red" : "blue",
              position,
            });
          }
        });
      }

      return {
        matchNumber: m.matchNumber,
        compLevel: "qm",
        teams,
        startTime: m.startTime,
      };
    })
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

function parseFtcMatchResults(matches: FtcMatchResult[]): MatchScheduleEntry[] {
  return matches
    .filter((m) => m.tournamentLevel === "QUALIFICATION")
    .map((m) => {
      const teams: MatchScheduleTeam[] = [];

      if (m.teams) {
        m.teams.forEach((team: FtcMatchResultTeam) => {
          if (team.teamNumber !== null && team.station) {
            const isRed = team.station.toLowerCase().startsWith("red");
            const position = parseInt(team.station.replace(/\D/g, "")) || 1;

            teams.push({
              teamNumber: team.teamNumber,
              alliance: isRed ? "red" : "blue",
              position,
            });
          }
        });
      }

      return {
        matchNumber: m.matchNumber,
        compLevel: "qm",
        teams,
        startTime: m.actualStartTime,
      };
    })
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> },
) {
  try {
    const { eventCode } = await params;
    const parsed = parseEventRequest(request, { requireFtcYear: true });
    if (parsed.error) return parsed.error;
    const { competitionType, year: seasonNum } = parsed.data;

    if (!eventCode) {
      return NextResponse.json({ error: "Missing eventCode" }, { status: 400 });
    }

    if (competitionType === "FTC") {
      // First try to get the schedule (may not be available yet)
      let matches: MatchScheduleEntry[] = [];

      try {
        const scheduleResponse = await getFtcEventSchedule(
          seasonNum!,
          eventCode,
          "qual",
        );
        if (scheduleResponse.schedule && scheduleResponse.schedule.length > 0) {
          matches = parseFtcSchedule(scheduleResponse.schedule);
        }
      } catch {
        // Schedule endpoint might fail if not available yet
        console.log("FTC schedule endpoint failed, trying matches endpoint");
      }

      // If schedule is empty, try to get from match results
      if (matches.length === 0) {
        try {
          const matchesResponse = await getFtcEventMatches(
            seasonNum!,
            eventCode,
            "qual",
          );
          if (matchesResponse.matches && matchesResponse.matches.length > 0) {
            matches = parseFtcMatchResults(matchesResponse.matches);
          }
        } catch {
          console.log("FTC matches endpoint also failed");
        }
      }

      return NextResponse.json({
        matches,
        competitionType: "FTC",
      } as MatchScheduleResponse);
    }

    // FRC via TBA
    const matches = await getTbaEventMatches(eventCode);
    return NextResponse.json({
      matches: parseTbaMatches(matches),
      competitionType: "FRC",
    } as MatchScheduleResponse);
  } catch (err) {
    console.error("Event schedule proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch event schedule" },
      { status: 502 },
    );
  }
}
