import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { getDbService } from "@/lib/server/db-service";
import { invalidateSessionUser } from "@/lib/server/session-user-cache";
import { validateImportAgainstSchema } from "@/lib/server/import-schema-validator";
import {
  InvalidSpreadsheetError,
  MAX_IMPORT_FILE_BYTES,
  parseCsvImport,
  parseXlsxImport,
} from "@/lib/server/scouting-import-parser";
import { MatchEntry, normalizeDriveTrain, PitEntry } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";


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

      if (file.size > MAX_IMPORT_FILE_BYTES) {
        return NextResponse.json(
          { error: "File is too large to import" },
          { status: 413 },
        );
      }

      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".json")) {
        const text = await file.text();
        data = JSON.parse(text);
      } else if (fileName.endsWith(".csv")) {
        data = await parseCsvImport(await file.text());
      } else if (fileName.endsWith(".xlsx")) {
        try {
          data = await parseXlsxImport(await file.arrayBuffer());
        } catch (error) {
          if (error instanceof InvalidSpreadsheetError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          throw error;
        }
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
    data.matchEntries = Array.isArray(data.matchEntries)
      ? data.matchEntries
      : [];

    // JSON imports (and hand-edited sheets) may carry string numbers or
    // lowercase drivetrains, so normalize before anything hits the database.
    for (const entry of data.pitEntries) {
      const driveTrain = normalizeDriveTrain(entry.driveTrain);
      if (!driveTrain) {
        return NextResponse.json(
          { error: `Invalid drivetrain "${entry.driveTrain}" for team ${entry.teamNumber}` },
          { status: 400 },
        );
      }
      entry.driveTrain = driveTrain;
      entry.teamNumber = Number(entry.teamNumber);
      entry.year = Number(entry.year);
      for (const key of ["weight", "length", "width"] as const) {
        const value = entry[key] as unknown;
        entry[key] =
          value === undefined || value === null || value === "" ? undefined : Number(value);
      }
    }

    for (const entry of data.matchEntries) {
      entry.matchNumber = Number(entry.matchNumber);
      entry.teamNumber = Number(entry.teamNumber);
      entry.year = Number(entry.year);
      if (entry.alliancePosition != null) {
        entry.alliancePosition = Number(entry.alliancePosition);
      }
      if (
        !Number.isInteger(entry.matchNumber) ||
        !Number.isInteger(entry.teamNumber)
      ) {
        return NextResponse.json(
          { error: `Invalid match/team number in match entry (match ${entry.matchNumber}, team ${entry.teamNumber})` },
          { status: 400 },
        );
      }
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
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const service = getDbService();
    await service.importData(data);
    invalidateSessionUser();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error importing data:", error);
    return NextResponse.json(
      { error: "Failed to import data" },
      { status: 500 },
    );
  }
}
