import { describe, expect, it, vi } from "vitest";

import {
  MariaDbDatabaseService,
  normalizeMariaDbTimestamp,
} from "@/db/mariadb-database-service";

describe("normalizeMariaDbTimestamp", () => {
  it("converts an ISO timestamp from a JSON request into a Date", () => {
    const timestamp = normalizeMariaDbTimestamp("2026-09-18T06:06:41.750Z");

    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.toISOString()).toBe("2026-09-18T06:06:41.750Z");
  });

  it("keeps valid Date instances", () => {
    const input = new Date("2026-01-01T00:00:00.000Z");

    expect(normalizeMariaDbTimestamp(input)).toBe(input);
  });

  it("rejects invalid timestamps before they reach MariaDB", () => {
    expect(() => normalizeMariaDbTimestamp("not-a-date")).toThrow(
      "Invalid match entry timestamp",
    );
  });

  it("passes a Date to mysql2 when adding a JSON-derived match entry", async () => {
    const execute = vi.fn().mockResolvedValue([{ insertId: 42 }]);
    const service = new MariaDbDatabaseService({});
    (
      service as unknown as {
        pool: { execute: typeof execute };
      }
    ).pool = { execute };

    await service.addMatchEntry({
      matchNumber: 1,
      teamNumber: 492,
      year: 2026,
      competitionType: "FRC",
      alliance: "red",
      gameSpecificData: {},
      notes: "",
      timestamp: "2026-09-18T06:06:41.750Z" as unknown as Date,
    });

    const parameters = execute.mock.calls[0][1] as unknown[];
    expect(parameters[11]).toBeInstanceOf(Date);
    expect((parameters[11] as Date).toISOString()).toBe(
      "2026-09-18T06:06:41.750Z",
    );
  });
});
