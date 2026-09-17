import { NextRequest, NextResponse } from "next/server";
import { getEventMatches as getTbaEventMatches } from "@/lib/api/tba";
import {
  getEventMatches as getFtcEventMatches,
  getEventSchedule as getFtcEventSchedule,
} from "@/lib/api/ftcevents";
import { TbaMatch } from "@/lib/api/tba-types";
import { parseEventRequest } from "@/lib/server/event-request";

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
      const response = await getFtcEventMatches(seasonNum!, eventCode);
      const matches = response.matches || [];
      const qualificationMatches = matches.filter(
        (match) => match.tournamentLevel === "QUALIFICATION",
      );
      const scheduleResponse = await getFtcEventSchedule(
        seasonNum!,
        eventCode,
        "qual",
      ).catch(() => null);
      const qualificationSchedule = scheduleResponse?.schedule ?? [];

      return NextResponse.json({
        matches,
        totalMatches: matches.length,
        qualMatchesCount:
          qualificationSchedule.length || qualificationMatches.length,
        qualificationSchedule,
      });
    }

    // FRC via TBA
    const matches = await getTbaEventMatches(eventCode);
    const qualMatchesCount = Array.isArray(matches)
      ? matches.filter((m: TbaMatch) => m.comp_level === "qm").length
      : 0;

    return NextResponse.json({
      matches,
      qualMatchesCount,
      totalMatches: Array.isArray(matches) ? matches.length : 0,
    });
  } catch (err) {
    console.error("Event matches proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch event matches" },
      { status: 502 },
    );
  }
}
