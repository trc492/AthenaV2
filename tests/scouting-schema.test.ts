import { describe, expect, it } from "vitest";
import { createMatchSchema, createPitSchema, updateMatchSchema, parseScoutingBody } from "@/lib/server/scouting-schema";

const match = {
  teamNumber: 254, year: 2026, competitionType: "FRC", matchNumber: 1,
  alliance: "red", notes: "", timestamp: "2026-03-01T12:00:00Z",
  gameSpecificData: { autonomous: { score: 3, climbed: true }, teleop: { score: 10 } },
};

describe("scouting request boundary", () => {
  it("normalizes timestamps and discards client-controlled ownership on creation", () => {
    const parsed = createMatchSchema.parse({ ...match, id: 99, userId: "other" });
    expect(parsed.timestamp).toEqual(new Date(match.timestamp));
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("userId");
  });
  it.each([
    { teamNumber: -1 }, { year: "2026" }, { competitionType: "invalid" },
    { timestamp: "bad" }, { gameSpecificData: [] }, { alliancePosition: 4 },
  ])("rejects invalid identity and scouting fields: %j", (updates) => {
    expect(createMatchSchema.safeParse({ ...match, ...updates }).success).toBe(false);
  });
  it("rejects ownership changes in updates while allowing partial edits", () => {
    expect(updateMatchSchema.safeParse({ id: 1, notes: "updated" }).success).toBe(true);
    expect(updateMatchSchema.safeParse({ id: 1, userId: "other" }).success).toBe(false);
    expect(updateMatchSchema.safeParse({ id: 1, notes: 42 }).success).toBe(false);
  });
  it("validates pit dimensions and drivetrain", () => {
    const pit = { teamNumber: 254, year: 2026, competitionType: "FRC", driveTrain: "Swerve", gameSpecificData: {} };
    expect(createPitSchema.safeParse(pit).success).toBe(true);
    expect(createPitSchema.safeParse({ ...pit, weight: -1 }).success).toBe(false);
    expect(createPitSchema.safeParse({ ...pit, driveTrain: "unknown" }).success).toBe(false);
  });
  it("reports malformed JSON as a client error", async () => {
    const result = await parseScoutingBody(new Request("http://test", { method: "POST", body: "{" }), createMatchSchema);
    expect(result.error?.status).toBe(400);
  });
});
