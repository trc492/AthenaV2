import { NextRequest, NextResponse } from "next/server";
import { getEventStatus as getNexusEventStatus } from "@/lib/api/nexus";
import { getEventMatches as getTbaEventMatches } from "@/lib/api/tba";
import {
  getEventMatches as getFtcEventMatches,
  getEventSchedule as getFtcEventSchedule,
} from "@/lib/api/ftcevents";
import { parseEventRequest } from "@/lib/server/event-request";

type MatchStatusResponse = {
  label: string | null;
  complete: boolean;
  source: "nexus" | "tba" | "first" | "unavailable";
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> },
) {
  const { eventCode } = await params;
  const parsed = parseEventRequest(request, { requireFtcYear: true });
  if (parsed.error) return parsed.error;
  const { competitionType, year: season } = parsed.data;

  try {
    if (competitionType === "FRC") {
      try {
        const nexus = await getNexusEventStatus(eventCode);
        if (nexus.nowQueuing) {
          return NextResponse.json({
            label: `Now queuing ${nexus.nowQueuing}`,
            complete: false,
            source: "nexus",
          } satisfies MatchStatusResponse);
        }
      } catch {
        // Nexus does not cover every event; TBA is the official fallback.
      }

      const matches = await getTbaEventMatches(eventCode);
      const ordered = [...matches].sort(
        (a, b) => (a.predicted_time || a.time) - (b.predicted_time || b.time),
      );
      const next = ordered.find(
        (match) => !match.actual_time && !match.post_result_time,
      );
      const finalPlayed = ordered.some(
        (match) => match.comp_level === "f" && !!match.post_result_time,
      );

      return NextResponse.json({
        label: next
          ? `${next.comp_level === "qm" ? "Qualification" : next.comp_level === "sf" ? "Semifinal" : next.comp_level === "f" ? "Final" : "Playoff"} ${next.match_number}`
          : null,
        complete: finalPlayed,
        source: "tba",
      } satisfies MatchStatusResponse);
    }

    const [scheduleResponse, resultsResponse] = await Promise.all([
      getFtcEventSchedule(season!, eventCode),
      getFtcEventMatches(season!, eventCode),
    ]);
    const results = resultsResponse.matches ?? [];
    const completed = new Set(
      results.map(
        (match) =>
          `${match.tournamentLevel}:${match.series}:${match.matchNumber}`,
      ),
    );
    const next = (scheduleResponse.schedule ?? []).find(
      (match) =>
        !completed.has(
          `${match.tournamentLevel}:${match.series}:${match.matchNumber}`,
        ),
    );
    const finalPlayed = results.some(
      (match) => match.tournamentLevel === "FINAL" && !!match.postResultTime,
    );

    return NextResponse.json({
      label: next
        ? `${next.description || next.tournamentLevel || "Match"} ${next.matchNumber}`
        : null,
      complete: finalPlayed,
      source: "first",
    } satisfies MatchStatusResponse);
  } catch (error) {
    console.error("Event status error:", error);
    return NextResponse.json({
      label: null,
      complete: false,
      source: "unavailable",
    } satisfies MatchStatusResponse);
  }
}
