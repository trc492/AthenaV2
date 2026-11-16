import type { MatchEntry, PitEntry } from "@/lib/types";

export type ParsedImport = { pitEntries: PitEntry[]; matchEntries: MatchEntry[] };

/** Uploads larger than this are rejected before any parsing happens. */
export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

/** Keys that would reach Object.prototype if used as property names. */
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const PIT_STANDARD_FIELDS = new Set([
  "type",
  "id",
  "teamNumber",
  "year",
  "competitionType",
  "driveTrain",
  "weight",
  "length",
  "width",
  "eventName",
  "eventCode",
  "userId",
  "notes",
  "autoDrawing",
]);

const MATCH_STANDARD_FIELDS = new Set([
  "type",
  "id",
  "matchNumber",
  "teamNumber",
  "year",
  "competitionType",
  "alliance",
  "alliancePosition",
  "eventName",
  "eventCode",
  "userId",
  "notes",
  "timestamp",
]);

/** XLSX files are ZIP containers; refuse anything else so the parser never sniffs other formats. */
function isZipContainer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/**
 * Rebuild one level of gameSpecificData from flattened `group_field` columns.
 * Unsafe keys are dropped so a crafted header cannot pollute Object.prototype.
 */
function buildGameSpecificData(
  type: unknown,
  entryData: Record<string, unknown>,
): Record<string, unknown> {
  const standardFields = type === "pit" ? PIT_STANDARD_FIELDS : MATCH_STANDARD_FIELDS;
  const gameSpecificData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(entryData)) {
    if (standardFields.has(key)) continue;

    const parts = key.split("_");
    if (parts.length >= 2) {
      const mainKey = parts[0];
      const subKey = parts.slice(1).join("_");
      if (UNSAFE_KEYS.has(mainKey) || UNSAFE_KEYS.has(subKey)) continue;

      const existing = Object.hasOwn(gameSpecificData, mainKey)
        ? gameSpecificData[mainKey]
        : undefined;
      const group =
        typeof existing === "object" && existing !== null
          ? (existing as Record<string, unknown>)
          : {};
      group[subKey] = value;
      gameSpecificData[mainKey] = group;
    } else if (!UNSAFE_KEYS.has(key)) {
      gameSpecificData[key] = value;
    }
  }

  return gameSpecificData;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

function optionalInt(value: unknown): number | undefined {
  return value ? parseInt(String(value)) : undefined;
}

function optionalFloat(value: unknown): number | undefined {
  return value ? parseFloat(String(value)) : undefined;
}

function competitionType(value: unknown): "FRC" | "FTC" {
  return (optionalString(value) || "FRC").toUpperCase() as "FRC" | "FTC";
}

/** Map flat spreadsheet rows (one entry per row, `type` = pit|match) to entries. */
export function rowsToEntries(rows: Record<string, unknown>[]): ParsedImport {
  const pitEntries: PitEntry[] = [];
  const matchEntries: MatchEntry[] = [];

  for (const row of rows) {
    const { type, ...entryData } = row;
    if (type !== "pit" && type !== "match") continue;

    const gameSpecificData = buildGameSpecificData(type, entryData);

    if (type === "pit") {
      pitEntries.push({
        id: optionalInt(entryData.id),
        teamNumber: parseInt(String(entryData.teamNumber)),
        year: parseInt(String(entryData.year)),
        competitionType: competitionType(entryData.competitionType),
        driveTrain: entryData.driveTrain as PitEntry["driveTrain"],
        weight: optionalFloat(entryData.weight),
        length: optionalFloat(entryData.length),
        width: optionalFloat(entryData.width),
        eventName: optionalString(entryData.eventName),
        eventCode: optionalString(entryData.eventCode),
        userId: optionalString(entryData.userId),
        notes: optionalString(entryData.notes),
        autoDrawing: optionalString(entryData.autoDrawing),
        gameSpecificData,
      } as PitEntry);
    } else {
      const timestamp = entryData.timestamp;
      matchEntries.push({
        id: optionalInt(entryData.id),
        matchNumber: parseInt(String(entryData.matchNumber)),
        teamNumber: parseInt(String(entryData.teamNumber)),
        year: parseInt(String(entryData.year)),
        competitionType: competitionType(entryData.competitionType),
        alliance: entryData.alliance as "red" | "blue",
        alliancePosition: optionalInt(entryData.alliancePosition),
        eventName: optionalString(entryData.eventName),
        eventCode: optionalString(entryData.eventCode),
        userId: optionalString(entryData.userId),
        notes: optionalString(entryData.notes) ?? "",
        timestamp:
          timestamp instanceof Date
            ? timestamp
            : timestamp
              ? new Date(String(timestamp))
              : new Date(),
        gameSpecificData,
      } as MatchEntry);
    }
  }

  return { pitEntries, matchEntries };
}

export async function parseCsvImport(text: string): Promise<ParsedImport> {
  const Papa = await import("papaparse");
  const results = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return rowsToEntries(results.data);
}

export class InvalidSpreadsheetError extends Error {}

export async function parseXlsxImport(buffer: ArrayBuffer): Promise<ParsedImport> {
  const bytes = new Uint8Array(buffer);
  if (!isZipContainer(bytes)) {
    throw new InvalidSpreadsheetError("File is not a valid .xlsx workbook");
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
  });

  // The export writes a single "Scouting Data" sheet; read the first one.
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) return { pitEntries: [], matchEntries: [] };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
  return rowsToEntries(rows);
}
