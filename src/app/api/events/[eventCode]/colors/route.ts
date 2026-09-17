import { NextRequest, NextResponse } from "next/server";
import { parseEventRequest } from "@/lib/server/event-request";

const FRC_COLORS_BASE_URL = "https://api.frc-colors.com/v1";

type FRCColorsTeam = {
  teamNumber: number;
  colors: {
    primaryHex: string;
    secondaryHex: string;
    verified: boolean;
  } | null;
};

type FRCColorsEventResponse = {
  teams: Record<string, FRCColorsTeam>;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> },
) {
  try {
    const { eventCode } = await params;
    const parsed = parseEventRequest(request);
    if (parsed.error) return parsed.error;
    const { competitionType } = parsed.data;

    if (!eventCode) {
      return NextResponse.json({ error: "Missing eventCode" }, { status: 400 });
    }

    if (competitionType !== "FRC") {
      return NextResponse.json({ teams: {} } satisfies FRCColorsEventResponse);
    }

    const response = await fetch(
      `${FRC_COLORS_BASE_URL}/event/${encodeURIComponent(eventCode)}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch event colors" },
        { status: 502 },
      );
    }

    const data = (await response.json()) as FRCColorsEventResponse;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Event colors proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch event colors" },
      { status: 502 },
    );
  }
}
