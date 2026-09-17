import { NextRequest, NextResponse } from "next/server";
import { getEventRankings as getTbaEventRankings } from "@/lib/api/tba";
import { getEventRankings as getFtcEventRankings } from "@/lib/api/ftcevents";
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
    const { searchParams } = request.nextUrl;

    if (!eventCode) {
      return NextResponse.json({ error: "Missing eventCode" }, { status: 400 });
    }

    if (competitionType === "FTC") {
      const teamNumber = searchParams.get("teamNumber");
      const top = searchParams.get("top");

      const response = await getFtcEventRankings(
        seasonNum!,
        eventCode,
        teamNumber ? parseInt(teamNumber) : undefined,
        top ? parseInt(top) : undefined,
      );

      return NextResponse.json(response);
    }

    // FRC via TBA
    const rankings = await getTbaEventRankings(eventCode);

    return NextResponse.json(rankings);
  } catch (err) {
    console.error("Event rankings proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch event rankings" },
      { status: 502 },
    );
  }
}
