import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { PitEntry, MatchEntry, DatabaseService } from "@/lib/types";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";

// Initialize database service
let dbService: DatabaseService;

function getDbService() {
  if (!dbService) {
    dbService = databaseManager.getService();
  }
  return dbService;
}

// GET /api/admin/export - Export all data
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EXPORT_DATA)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const format = searchParams.get("format") || "json";
    const competitionType =
      (searchParams.get("competitionType") as "FRC" | "FTC") || undefined;
    const eventCode = searchParams.get("eventCode") || undefined;
    // `types` can be a comma-separated list: 'pit', 'match', or omitted for all
    const typesParam = searchParams.get("types");
    const requestedTypes = typesParam
      ? typesParam
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : null;

    const service = getDbService();
    let data = await service.exportData(year);

    // Filter by competition type if specified
    if (competitionType) {
      data = {
        pitEntries: data.pitEntries.filter(
          (entry) => entry.competitionType === competitionType,
        ),
        matchEntries: data.matchEntries.filter(
          (entry) => entry.competitionType === competitionType,
        ),
      };
    }

    // Filter by event code if specified
    if (eventCode) {
      data = {
        pitEntries: data.pitEntries.filter(
          (entry) => entry.eventCode === eventCode,
        ),
        matchEntries: data.matchEntries.filter(
          (entry) => entry.eventCode === eventCode,
        ),
      };
    }

    // Filter data based on requestedTypes parameter (supports comma-separated values)
    if (requestedTypes) {
      const includePit = requestedTypes.includes("pit");
      const includeMatch = requestedTypes.includes("match");

      // For JSON format, completely omit deselected types
      if (format === "json") {
        const filteredData: {
          pitEntries?: PitEntry[];
          matchEntries?: MatchEntry[];
        } = {};
        if (includePit) filteredData.pitEntries = data.pitEntries;
        if (includeMatch) filteredData.matchEntries = data.matchEntries;
        data = filteredData as {
          pitEntries: PitEntry[];
          matchEntries: MatchEntry[];
        };
      } else {
        // For CSV/XLSX, keep empty arrays
        data = {
          pitEntries: includePit ? data.pitEntries : [],
          matchEntries: includeMatch ? data.matchEntries : [],
        };
      }
    }

    // Build descriptive filename
    const dataTypeStr = requestedTypes
      ? requestedTypes.length === 2
        ? "all"
        : requestedTypes[0]
      : "all";
    const yearStr = year ? year.toString() : "all-years";
    const compTypeStr = competitionType || "all";
    const eventStr = eventCode ? `-${eventCode}` : "";
    const baseFilename = `${compTypeStr}-${yearStr}-${dataTypeStr}-scouting${eventStr}`;

    if (format === "csv") {
      const csvData = await convertToCSV(data);
      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${baseFilename}.csv"`,
        },
      });
    } else if (format === "xlsx") {
      const xlsxData = await convertToXLSX(data);
      return new NextResponse(xlsxData, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
        },
      });
    } else {
      // Default to JSON
      return new NextResponse(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${baseFilename}.json"`,
        },
      });
    }
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 },
    );
  }
}

// Helper functions for data conversion
async function convertToCSV(data: {
  pitEntries: PitEntry[];
  matchEntries: MatchEntry[];
}): Promise<string> {
  const Papa = await import("papaparse");

  // Function to expand gameSpecificData (only one level)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expandGameSpecificData = (gameSpecificData: Record<string, any>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expanded: Record<string, any> = {};

    for (const [key, value] of Object.entries(gameSpecificData)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // If it's an object, expand its properties as key_value pairs (one level only)
        for (const [subKey, subValue] of Object.entries(value)) {
          expanded[`${key}_${subKey}`] = subValue;
        }
      } else {
        // For simple values, keep as is
        expanded[key] = value;
      }
    }

    return expanded;
  };

  // Expand pit entries
  const expandedPitEntries = data.pitEntries.map((entry) => {
    const gameSpecificExpanded = expandGameSpecificData(entry.gameSpecificData);
    return {
      type: "pit",
      id: entry.id,
      teamNumber: entry.teamNumber,
      year: entry.year,
      competitionType: entry.competitionType || "FRC",
      driveTrain: entry.driveTrain,
      weight: entry.weight,
      length: entry.length,
      width: entry.width,
      eventName: entry.eventName,
      eventCode: entry.eventCode,
      ...gameSpecificExpanded,
    };
  });

  // Expand match entries
  const expandedMatchEntries = data.matchEntries.map((entry) => {
    const gameSpecificExpanded = expandGameSpecificData(entry.gameSpecificData);
    return {
      type: "match",
      id: entry.id,
      matchNumber: entry.matchNumber,
      teamNumber: entry.teamNumber,
      year: entry.year,
      competitionType: entry.competitionType || "FRC",
      alliance: entry.alliance,
      eventName: entry.eventName,
      eventCode: entry.eventCode,
      notes: entry.notes,
      timestamp: entry.timestamp,
      ...gameSpecificExpanded,
    };
  });

  // Combine all entries into one CSV
  const allEntries = [...expandedPitEntries, ...expandedMatchEntries];
  return Papa.unparse(allEntries);
}

async function convertToXLSX(data: {
  pitEntries: PitEntry[];
  matchEntries: MatchEntry[];
}): Promise<ArrayBuffer> {
  const XLSX = await import("xlsx-js-style");

  // Function to expand gameSpecificData (only one level)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expandGameSpecificData = (gameSpecificData: Record<string, any>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expanded: Record<string, any> = {};

    for (const [key, value] of Object.entries(gameSpecificData)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // If it's an object, expand its properties as key_value pairs (one level only)
        for (const [subKey, subValue] of Object.entries(value)) {
          expanded[`${key}_${subKey}`] = subValue;
        }
      } else {
        // For simple values, keep as is
        expanded[key] = value;
      }
    }

    return expanded;
  };

  const workbook = XLSX.utils.book_new();

  // Expand pit entries
  const expandedPitEntries = data.pitEntries.map((entry) => {
    const gameSpecificExpanded = expandGameSpecificData(entry.gameSpecificData);
    return {
      type: "pit",
      id: entry.id,
      teamNumber: entry.teamNumber,
      year: entry.year,
      competitionType: entry.competitionType || "FRC",
      driveTrain: entry.driveTrain,
      weight: entry.weight,
      length: entry.length,
      width: entry.width,
      eventName: entry.eventName,
      eventCode: entry.eventCode,
      ...gameSpecificExpanded,
    };
  });

  // Expand match entries
  const expandedMatchEntries = data.matchEntries.map((entry) => {
    const gameSpecificExpanded = expandGameSpecificData(entry.gameSpecificData);
    return {
      type: "match",
      id: entry.id,
      matchNumber: entry.matchNumber,
      teamNumber: entry.teamNumber,
      year: entry.year,
      competitionType: entry.competitionType || "FRC",
      alliance: entry.alliance,
      eventName: entry.eventName,
      eventCode: entry.eventCode,
      notes: entry.notes,
      timestamp: entry.timestamp,
      ...gameSpecificExpanded,
    };
  });

  // Combine all entries into one sheet
  const allEntries = [...expandedPitEntries, ...expandedMatchEntries];
  const worksheet = XLSX.utils.json_to_sheet(allEntries);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Scouting Data");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
