import { afterEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  InvalidSpreadsheetError,
  parseCsvImport,
  parseXlsxImport,
  rowsToEntries,
} from "@/lib/server/scouting-import-parser";

function workbookBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Scouting Data");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

type Bag = Record<string, unknown>;

function sharedBuiltinsPolluted(): boolean {
  return (
    (Object as unknown as Bag).polluted !== undefined ||
    (Object.prototype as Bag).polluted !== undefined ||
    (Object.prototype.toString as unknown as Bag).polluted !== undefined ||
    (Object.prototype.hasOwnProperty as unknown as Bag).polluted !== undefined
  );
}

afterEach(() => {
  // Guard against a regression leaking into every other test.
  delete (Object as unknown as Bag).polluted;
  delete (Object.prototype as Bag).polluted;
  delete (Object.prototype.toString as unknown as Bag).polluted;
  delete (Object.prototype.hasOwnProperty as unknown as Bag).polluted;
});

describe("scouting import parser", () => {
  it("round-trips an exported workbook, including match timestamps", async () => {
    const timestamp = new Date("2025-03-14T15:00:00Z");
    const buffer = workbookBuffer([
      { type: "pit", id: 1, teamNumber: 111, year: 2025, driveTrain: "Tank", weight: 120, auto_left: 1 },
      { type: "match", matchNumber: 4, teamNumber: 222, year: 2025, alliance: "red", timestamp, teleop_coral: 7 },
    ]);

    const { pitEntries, matchEntries } = await parseXlsxImport(buffer);

    expect(pitEntries).toHaveLength(1);
    expect(pitEntries[0]).toMatchObject({
      id: 1,
      teamNumber: 111,
      driveTrain: "Tank",
      weight: 120,
      competitionType: "FRC",
      gameSpecificData: { auto: { left: 1 } },
    });
    expect(matchEntries).toHaveLength(1);
    expect(matchEntries[0]).toMatchObject({
      matchNumber: 4,
      teamNumber: 222,
      alliance: "red",
      gameSpecificData: { teleop: { coral: 7 } },
    });
    // Dates come back as Date cells, not Excel serial numbers.
    expect(Math.abs(matchEntries[0].timestamp.getTime() - timestamp.getTime())).toBeLessThan(1000);
  });

  it("rejects files that are not xlsx ZIP containers", async () => {
    const html = new TextEncoder().encode("<table><tr><td>type</td></tr></table>");
    await expect(parseXlsxImport(html.buffer)).rejects.toBeInstanceOf(InvalidSpreadsheetError);
  });

  it.each(["constructor_polluted", "x___proto__", "prototype_polluted"])(
    "drops the unsafe header %s",
    async (header) => {
      const csv = `type,teamNumber,year,driveTrain,${header}\npit,111,2025,Tank,yes`;
      const { pitEntries } = await parseCsvImport(csv);

      expect(sharedBuiltinsPolluted()).toBe(false);
      expect(Object.keys(pitEntries[0].gameSpecificData)).toEqual([]);
    },
  );

  it.each(["toString_polluted", "hasOwnProperty_polluted"])(
    "keeps %s as plain data without touching the inherited built-in",
    async (header) => {
      const csv = `type,teamNumber,year,driveTrain,${header}\npit,111,2025,Tank,yes`;
      const { pitEntries } = await parseCsvImport(csv);
      const mainKey = header.split("_")[0];

      expect(sharedBuiltinsPolluted()).toBe(false);
      expect(Object.hasOwn(pitEntries[0].gameSpecificData, mainKey)).toBe(true);
      expect(pitEntries[0].gameSpecificData[mainKey]).toEqual({ polluted: "yes" });
    },
  );

  it("guards xlsx uploads the same way", async () => {
    const buffer = workbookBuffer([
      { type: "match", matchNumber: 1, teamNumber: 1, year: 2025, constructor_polluted: "yes", auto_left: 2 },
    ]);
    const { matchEntries } = await parseXlsxImport(buffer);

    expect(sharedBuiltinsPolluted()).toBe(false);
    expect(matchEntries[0].gameSpecificData).toEqual({ auto: { left: 2 } });
  });

  it("skips rows without a pit or match type", () => {
    expect(rowsToEntries([{ type: "other", teamNumber: 1 }, { teamNumber: 2 }])).toEqual({
      pitEntries: [],
      matchEntries: [],
    });
  });
});
