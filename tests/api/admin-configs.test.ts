import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateYearConfig } from "@/lib/server/config-validator";
import type { YearConfig } from "@/lib/types";

const { mockAuthSession, mockWriteFile, mockMkdir } = vi.hoisted(() => {
  return {
    mockAuthSession: { value: { user: { id: "user-admin", role: "admin" } } as any },
    mockWriteFile: vi.fn(),
    mockMkdir: vi.fn(),
  };
});

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(async () => mockAuthSession.value),
}));

vi.mock("@/lib/auth/roles", () => ({
  hasPermission: vi.fn((role: string) => role === "admin"),
  PERMISSIONS: {
    MANAGE_GAME_CONFIG: "manage_game_config",
    MANAGE_SYSTEM_CONFIG: "manage_system_config",
  },
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  };
});

describe("validateYearConfig", () => {
  it("validates a complete and correct FRC configuration", () => {
    const sampleConfig: YearConfig = {
      competitionType: "FRC",
      gameName: "TEST_GAME",
      startPositions: ["Left", "Center", "Right"],
      scoring: {
        autonomous: {
          leave: { label: "Leave", points: 2, type: "boolean", description: "Leave zone" },
          scored: { label: "Scored", points: 3, increments: [1, 5], description: "Balls scored" },
        },
        teleop: {
          scored: { label: "Scored", points: 2, increments: [1, 5], description: "Teleop scored" },
        },
        endgame: {
          climb: {
            label: "Climb",
            description: "Climb level",
            type: "select",
            pointValues: { none: 0, L1: 10, L2: 20 },
          },
        },
      },
      pitScouting: {
        autonomous: {
          autoRoutine: { label: "Auto Routine", type: "text" },
        },
        teleoperated: {
          driveTrain: { label: "Drivetrain", type: "select", options: ["Swerve", "Tank"] },
        },
        endgame: {},
      },
    };

    const result = validateYearConfig(sampleConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("catches missing required fields", () => {
    const invalidConfig = {
      gameName: "NO_COMP_TYPE",
    };

    const result = validateYearConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("competitionType"))).toBe(true);
    expect(result.errors.some((e) => e.includes("scoring"))).toBe(true);
    expect(result.errors.some((e) => e.includes("pitScouting"))).toBe(true);
  });

  it("catches invalid scoring definition types", () => {
    const invalidConfig = {
      competitionType: "FRC",
      gameName: "INVALID_SCORING",
      scoring: {
        autonomous: {
          badField: { label: "Bad Field", type: "invalid_type", description: "" },
        },
        teleop: {},
        endgame: {},
      },
      pitScouting: {},
    };

    const result = validateYearConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid value 'invalid_type'"))).toBe(true);
  });
});

describe("Admin Configs API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession.value = { user: { id: "user-admin", role: "admin" } };
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  it("GET lists configs when authorized", async () => {
    const route = await import("@/app/api/scouting/admin/configs/route");
    const response = await route.GET(new Request("http://test/api/scouting/admin/configs") as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("configs");
    expect(Array.isArray(json.configs)).toBe(true);
    expect(json.configs.length).toBeGreaterThan(0);
  });

  it("POST rejects unauthorized users", async () => {
    mockAuthSession.value = { user: { id: "user-scout", role: "scout" } };
    const route = await import("@/app/api/scouting/admin/configs/route");
    const response = await route.POST(
      new Request("http://test/api/scouting/admin/configs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }) as any,
    );

    expect(response.status).toBe(403);
  });

  it("POST validates config before saving", async () => {
    mockAuthSession.value = { user: { id: "user-admin", role: "admin" } };
    const route = await import("@/app/api/scouting/admin/configs/route");
    const response = await route.POST(
      new Request("http://test/api/scouting/admin/configs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          config: {
            competitionType: "FRC",
            // missing gameName, scoring, pitScouting
          },
        }),
      }) as any,
    );

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.errors.length).toBeGreaterThan(0);
  });
});
