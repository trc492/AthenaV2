import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { PitEntry, MatchEntry, DatabaseService } from "@/lib/types";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { validateImportAgainstSchema } from "@/lib/server/import-schema-validator";

// Initialize database service
let dbService: DatabaseService;

function getDbService() {
  if (!dbService) {
    dbService = databaseManager.getService();
  }
  return dbService;
}

// POST /api/admin/import - Import data
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.IMPORT_DATA)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const contentType = request.headers.get("content-type") || "";

    let data: { pitEntries?: PitEntry[]; matchEntries?: MatchEntry[] };

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 },
        );
      }

      if (file.name.endsWith(".json")) {
        const text = await file.text();
        data = JSON.parse(text);
      } else if (file.name.endsWith(".csv")) {
        data = await parseCSV(file);
      } else if (file.name.endsWith(".xlsx")) {
        data = await parseXLSX(file);
      } else {
        return NextResponse.json(
          { error: "Unsupported file format" },
          { status: 400 },
        );
      }
    } else {
      // Handle JSON data
      data = await request.json();
    }

    data.pitEntries = Array.isArray(data.pitEntries) ? data.pitEntries : [];
    data.matchEntries = Array.isArray(data.matchEntries) ? data.matchEntries : [];

    for (const entry of data.matchEntries) {
      if (!(entry.timestamp instanceof Date)) {
        entry.timestamp = new Date(entry.timestamp);
      }

      if (Number.isNaN(entry.timestamp.getTime())) {
        return NextResponse.json(
          {
            error: `Invalid timestamp for match ${entry.matchNumber}, team ${entry.teamNumber}`,
          },
          { status: 400 },
        );
      }
    }

    // Validate schema configurations match the imported data
    const validation = validateImportAgainstSchema(data);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 },
      );
    }

    const service = getDbService();
    await service.importData(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error importing data:", error);
    return NextResponse.json(
      { error: "Failed to import data" },
      { status: 500 },
    );
  }
}

async function parseCSV(
  file: File,
): Promise<{ pitEntries: PitEntry[]; matchEntries: MatchEntry[] }> {
  const Papa = await import("papaparse");
  const text = await file.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const allRows = results.data as Record<string, unknown>[];
        const pitEntries: PitEntry[] = [];
        const matchEntries: MatchEntry[] = [];

        // Define standard fields for pit and match entries
        const pitStandardFields = new Set([
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
        const matchStandardFields = new Set([
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

        allRows.forEach((row: Record<string, unknown>) => {
          const { type, ...entryData } = row;

          // Reconstruct gameSpecificData from expanded columns (one level)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gameSpecificData: Record<string, any> = {};

          for (const [key, value] of Object.entries(entryData)) {
            if (
              (type === "pit" && !pitStandardFields.has(key)) ||
              (type === "match" && !matchStandardFields.has(key))
            ) {
              // This is a game-specific field, reconstruct the nested structure
              const parts = key.split("_");
              if (parts.length >= 2) {
                const mainKey = parts[0];
                const subKey = parts.slice(1).join("_");

                if (!gameSpecificData[mainKey]) {
                  gameSpecificData[mainKey] = {};
                }
                gameSpecificData[mainKey][subKey] = value;
              } else {
                // If no underscore, keep as top-level field
                gameSpecificData[key] = value;
              }
            }
          }

          if (type === "pit") {
            pitEntries.push({
              id: entryData.id ? parseInt(entryData.id as string) : undefined,
              teamNumber: parseInt(entryData.teamNumber as string),
              year: parseInt(entryData.year as string),
              competitionType: ((entryData.competitionType as string) || "FRC").toUpperCase() as "FRC" | "FTC",
              driveTrain: entryData.driveTrain as
                | "Swerve"
                | "Mecanum"
                | "Tank"
                | "Other",
              weight: entryData.weight ? parseFloat(entryData.weight as string) : undefined,
              length: entryData.length ? parseFloat(entryData.length as string) : undefined,
              width: entryData.width ? parseFloat(entryData.width as string) : undefined,
              eventName: (entryData.eventName as string) || undefined,
              eventCode: (entryData.eventCode as string) || undefined,
              userId: (entryData.userId as string) || undefined,
              notes: (entryData.notes as string) || undefined,
              autoDrawing: (entryData.autoDrawing as string) || undefined,
              gameSpecificData,
            } as PitEntry);
          } else if (type === "match") {
            matchEntries.push({
              id: entryData.id ? parseInt(entryData.id as string) : undefined,
              matchNumber: parseInt(entryData.matchNumber as string),
              teamNumber: parseInt(entryData.teamNumber as string),
              year: parseInt(entryData.year as string),
              competitionType: ((entryData.competitionType as string) || "FRC").toUpperCase() as "FRC" | "FTC",
              alliance: entryData.alliance as "red" | "blue",
              alliancePosition: entryData.alliancePosition
                ? parseInt(entryData.alliancePosition as string)
                : undefined,
              eventName: (entryData.eventName as string) || undefined,
              eventCode: (entryData.eventCode as string) || undefined,
              userId: (entryData.userId as string) || undefined,
              notes: (entryData.notes as string) || "",
              timestamp: entryData.timestamp
                ? new Date(entryData.timestamp as string)
                : new Date(),
              gameSpecificData,
            } as MatchEntry);
          }
        });

        resolve({ pitEntries, matchEntries });
      },
      error: reject,
    });
  });
}

async function parseXLSX(
  file: File,
): Promise<{ pitEntries: PitEntry[]; matchEntries: MatchEntry[] }> {
  const XLSX = await import("xlsx-js-style");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  // Use the first sheet (should be 'Scouting Data')
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    return { pitEntries: [], matchEntries: [] };
  }

  const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
  const pitEntries: PitEntry[] = [];
  const matchEntries: MatchEntry[] = [];

  // Define standard fields for pit and match entries
  const pitStandardFields = new Set([
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
  const matchStandardFields = new Set([
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

  rows.forEach((row: Record<string, unknown>) => {
    const { type, ...entryData } = row;

    // Reconstruct gameSpecificData from expanded columns (one level)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gameSpecificData: Record<string, any> = {};

    for (const [key, value] of Object.entries(entryData)) {
      if (
        (type === "pit" && !pitStandardFields.has(key)) ||
        (type === "match" && !matchStandardFields.has(key))
      ) {
        // This is a game-specific field, reconstruct the nested structure
        const parts = key.split("_");
        if (parts.length >= 2) {
          const mainKey = parts[0];
          const subKey = parts.slice(1).join("_");

          if (!gameSpecificData[mainKey]) {
            gameSpecificData[mainKey] = {};
          }
          gameSpecificData[mainKey][subKey] = value;
        } else {
          // If no underscore, keep as top-level field
          gameSpecificData[key] = value;
        }
      }
    }

    if (type === "pit") {
      pitEntries.push({
        id: entryData.id ? parseInt(entryData.id as string) : undefined,
        teamNumber: parseInt(entryData.teamNumber as string),
        year: parseInt(entryData.year as string),
        competitionType: ((entryData.competitionType as string) || "FRC").toUpperCase() as "FRC" | "FTC",
        driveTrain: entryData.driveTrain as
          | "Swerve"
          | "Mecanum"
          | "Tank"
          | "Other",
        weight: entryData.weight ? parseFloat(entryData.weight as string) : undefined,
        length: entryData.length ? parseFloat(entryData.length as string) : undefined,
        width: entryData.width ? parseFloat(entryData.width as string) : undefined,
        eventName: (entryData.eventName as string) || undefined,
        eventCode: (entryData.eventCode as string) || undefined,
        userId: (entryData.userId as string) || undefined,
        notes: (entryData.notes as string) || undefined,
        autoDrawing: (entryData.autoDrawing as string) || undefined,
        gameSpecificData,
      } as PitEntry);
    } else if (type === "match") {
      matchEntries.push({
        id: entryData.id ? parseInt(entryData.id as string) : undefined,
        matchNumber: parseInt(entryData.matchNumber as string),
        teamNumber: parseInt(entryData.teamNumber as string),
        year: parseInt(entryData.year as string),
        competitionType: ((entryData.competitionType as string) || "FRC").toUpperCase() as "FRC" | "FTC",
        alliance: entryData.alliance as "red" | "blue",
        alliancePosition: entryData.alliancePosition
          ? parseInt(entryData.alliancePosition as string)
          : undefined,
        eventName: (entryData.eventName as string) || undefined,
        eventCode: (entryData.eventCode as string) || undefined,
        userId: (entryData.userId as string) || undefined,
        notes: (entryData.notes as string) || "",
        timestamp: entryData.timestamp
          ? new Date(entryData.timestamp as string)
          : new Date(),
        gameSpecificData,
      } as MatchEntry);
    }
  });

  return { pitEntries, matchEntries };
}
