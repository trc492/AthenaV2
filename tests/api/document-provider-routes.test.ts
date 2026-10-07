import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  hasAdmin: vi.fn(),
  getAssignments: vi.fn(),
  role: "admin",
}));
vi.mock("@/db/database-manager", () => ({
  databaseManager: {
    isConfigured: () => true,
    getConfig: () => ({ provider: "firebase" }),
    getService: () => ({ users: { hasAdmin: mocks.hasAdmin }, getScheduleAssignments: mocks.getAssignments }),
  },
}));
vi.mock("@/lib/server/env-file", () => ({ loadAppConfig: () => ({ appUrl: "https://athena.test" }) }));
vi.mock("@/lib/auth/config", () => ({ auth: async () => ({ user: { id: "one", role: mocks.role } }) }));
vi.mock("@/lib/auth/roles", () => ({ hasPermission: (role: string) => role === "admin", PERMISSIONS: { VIEW_SCHEDULE: "view_schedule" } }));
import { checkSetupStatus } from "@/lib/server/setup";
import { GET } from "@/app/api/scouting/entries/match-assignments/route";

beforeEach(() => { vi.clearAllMocks(); mocks.hasAdmin.mockResolvedValue(false); mocks.getAssignments.mockResolvedValue([]); mocks.role = "admin"; });
describe("document-provider setup and schedule routes", () => {
  it("requires the first admin even when the provider has no SQL query method", async () => {
    expect(await checkSetupStatus()).toMatchObject({ isComplete: false, needsAdmin: true, needsDatabase: false });
    mocks.hasAdmin.mockResolvedValue(true);
    expect(await checkSetupStatus()).toMatchObject({ isComplete: true, needsAdmin: false });
  });
  it.each(["FRC", "FTC"])("reads %s assignments using the document provider capability", async (competitionType) => {
    mocks.getAssignments.mockResolvedValue([{ matchNumber: 1, alliance: "red", position: 0, userId: "one" }]);
    const response = await GET(new NextRequest(`http://test/api/scouting/entries/match-assignments?eventCode=test&year=2026&competitionType=${competitionType}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ eventCode: "test", year: 2026, matchNumber: 1, alliance: "red", position: 0, userId: "one" }]);
    expect(mocks.getAssignments).toHaveBeenCalledWith({ eventCode: "test", year: 2026, competitionType });
  });
  it("retains schedule permissions", async () => {
    mocks.role = "external";
    const response = await GET(new NextRequest("http://test/api/scouting/entries/match-assignments?eventCode=test&year=2026&competitionType=FRC"));
    expect(response.status).toBe(403);
    expect(mocks.getAssignments).not.toHaveBeenCalled();
  });
});
