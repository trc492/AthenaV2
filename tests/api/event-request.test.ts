import { describe, expect, it } from "vitest";
import { parseEventRequest } from "@/lib/server/event-request";
import { NextRequest } from "next/server";

describe("parseEventRequest", () => {
  it("rejects unknown competition types", async () => {
    const request = new NextRequest(
      "http://test/api/events/test/teams?competitionType=VEX",
    );
    const result = parseEventRequest(request);

    expect(result.error?.status).toBe(400);
  });

  it("requires and parses the FTC season", () => {
    const missing = parseEventRequest(
      new NextRequest(
        "http://test/api/events/test/teams?competitionType=FTC",
      ),
      { requireFtcYear: true },
    );
    const present = parseEventRequest(
      new NextRequest(
        "http://test/api/events/test/teams?competitionType=FTC&season=2025",
      ),
      { requireFtcYear: true },
    );

    expect(missing.error?.status).toBe(400);
    expect(present.data).toEqual({ competitionType: "FTC", year: 2025 });
  });

  it("rejects partial numeric years", () => {
    const result = parseEventRequest(
      new NextRequest(
        "http://test/api/events/test/teams?competitionType=FTC&year=2025oops",
      ),
      { requireFtcYear: true },
    );

    expect(result.error?.status).toBe(400);
  });
});
