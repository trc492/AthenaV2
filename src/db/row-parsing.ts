import type { MatchEntry } from "@/lib/types";

/** Shape of the JSON blob stored in the `gameSpecificData` column. */
export type GameSpecificData = MatchEntry["gameSpecificData"];

/**
 * Providers persist `gameSpecificData` as a JSON string (or, for document
 * stores, as an already-parsed object). `JSON.parse` is typed `any`, so funnel
 * every read through here to keep the parsed value typed at the boundary.
 */
export function parseGameSpecificData(value: unknown): GameSpecificData {
  if (value && typeof value === "object") return value as GameSpecificData;
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as GameSpecificData) : {};
  } catch {
    return {};
  }
}

/** Parses a JSON string column that holds an array of strings. */
export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Driver errors are thrown as `unknown`; both mysql2 and mssql attach a string
 * `code` alongside the message, which the write paths use to detect duplicates.
 */
export function getDriverErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/** Message of an unknown thrown value, without assuming it is an `Error`. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

/**
 * SQL Server surfaces constraint violations as a numeric `number` field on the
 * thrown `RequestError`.
 */
export function getDriverErrorNumber(error: unknown): number | undefined {
  if (error && typeof error === "object" && "number" in error) {
    const number = (error as { number?: unknown }).number;
    if (typeof number === "number") return number;
  }
  return undefined;
}
