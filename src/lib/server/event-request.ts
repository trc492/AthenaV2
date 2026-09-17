import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { CompetitionType } from "@/lib/types";

const competitionTypeSchema = z.enum(["FRC", "FTC"]);
const yearSchema = z.coerce.number().int().min(1992).max(2100);

export type EventRequestData = {
  competitionType: CompetitionType;
  year?: number;
};

export function parseEventRequest(
  request: NextRequest,
  options: { requireFtcYear?: boolean } = {},
):
  | { data: EventRequestData; error: null }
  | { data: null; error: NextResponse } {
  const params = request.nextUrl.searchParams;
  const competitionResult = competitionTypeSchema.safeParse(
    params.get("competitionType") ?? "FRC",
  );
  if (!competitionResult.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'competitionType must be "FRC" or "FTC"' },
        { status: 400 },
      ),
    };
  }

  const rawYear = params.get("season") ?? params.get("year");
  const yearResult = rawYear === null ? null : yearSchema.safeParse(rawYear);
  if (yearResult && !yearResult.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: "season/year must be an integer between 1992 and 2100" },
        { status: 400 },
      ),
    };
  }
  if (
    options.requireFtcYear &&
    competitionResult.data === "FTC" &&
    !yearResult
  ) {
    return {
      data: null,
      error: NextResponse.json(
        { error: "season/year is required for FTC" },
        { status: 400 },
      ),
    };
  }

  return {
    data: {
      competitionType: competitionResult.data,
      year: yearResult?.data,
    },
    error: null,
  };
}
