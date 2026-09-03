import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { validateYearConfig } from "@/lib/server/config-validator";
import type { YearConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

const CONFIG_YEARS_DIR = join(process.cwd(), "config", "years");
const RUNTIME_CONFIGS_DIR = join(process.cwd(), ".runtime", "configs");

async function requireConfigAdmin() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role: string = (session.user as any).role ?? "";
  if (
    !hasPermission(role, PERMISSIONS.MANAGE_GAME_CONFIG) &&
    !hasPermission(role, PERMISSIONS.MANAGE_SYSTEM_CONFIG)
  ) {
    return NextResponse.json({ error: "Forbidden: Admin or Game Config management permission required." }, { status: 403 });
  }
  return null;
}

export interface ConfigSummary {
  filename: string;
  competitionType: string;
  year: number;
  gameName: string;
  isBuiltin: boolean;
  updatedAt?: string;
}

/**
 * Helper to scan a directory for JSON game configs
 */
async function loadConfigsFromDirectory(dir: string, isBuiltin: boolean): Promise<ConfigSummary[]> {
  if (!existsSync(dir)) return [];
  try {
    const files = await readdir(dir);
    const results: ConfigSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const fullPath = join(dir, file);
        const content = readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(content) as YearConfig;
        
        // Extract year from filename (e.g. FRC-2026.json) or config
        const match = file.match(/^(FRC|FTC)-(\d{4})\.json$/i);
        const year = match ? parseInt(match[2], 10) : new Date().getFullYear();
        const compType = parsed.competitionType || (match ? match[1].toUpperCase() : "FRC");

        results.push({
          filename: file,
          competitionType: compType,
          year,
          gameName: parsed.gameName || "Unknown Game",
          isBuiltin,
        });
      } catch (err) {
        console.error(`Error reading config file ${file}:`, err);
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * GET /api/scouting/admin/configs
 * List all configs or fetch a single config JSON
 */
export async function GET(req: NextRequest) {
  const denied = await requireConfigAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const fileParam = url.searchParams.get("file");
  const compParam = url.searchParams.get("competitionType");
  const yearParam = url.searchParams.get("year");

  // Fetching a specific config
  if (fileParam || (compParam && yearParam)) {
    const targetFilename = fileParam || `${compParam?.toUpperCase()}-${yearParam}.json`;

    // Security: sanitize filename
    if (!/^[a-zA-Z0-9_\-.]+\.json$/.test(targetFilename) || targetFilename.includes("..")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const primaryPath = join(CONFIG_YEARS_DIR, targetFilename);
    const runtimePath = join(RUNTIME_CONFIGS_DIR, targetFilename);

    let filePath: string | null = null;
    if (existsSync(primaryPath)) {
      filePath = primaryPath;
    } else if (existsSync(runtimePath)) {
      filePath = runtimePath;
    }

    if (!filePath) {
      return NextResponse.json({ error: `Config file ${targetFilename} not found` }, { status: 404 });
    }

    try {
      const raw = await readFile(filePath, "utf-8");
      const config = JSON.parse(raw);
      return NextResponse.json({
        filename: targetFilename,
        config,
      });
    } catch (err) {
      console.error(`Failed to load config ${targetFilename}:`, err);
      return NextResponse.json({ error: "Failed to read configuration file" }, { status: 500 });
    }
  }

  // Otherwise, list all configs
  try {
    const builtinConfigs = await loadConfigsFromDirectory(CONFIG_YEARS_DIR, true);
    const runtimeConfigs = await loadConfigsFromDirectory(RUNTIME_CONFIGS_DIR, false);

    // Merge without duplicates (primary dir overrides or vice versa)
    const configMap = new Map<string, ConfigSummary>();
    builtinConfigs.forEach((c) => configMap.set(c.filename, c));
    runtimeConfigs.forEach((c) => {
      if (!configMap.has(c.filename)) {
        configMap.set(c.filename, c);
      }
    });

    const configs = Array.from(configMap.values()).sort((a, b) => {
      if (a.competitionType !== b.competitionType) {
        return a.competitionType.localeCompare(b.competitionType);
      }
      return b.year - a.year;
    });

    return NextResponse.json({ configs });
  } catch (err) {
    console.error("Failed to list configs:", err);
    return NextResponse.json({ error: "Failed to retrieve configuration list" }, { status: 500 });
  }
}

/**
 * POST /api/scouting/admin/configs
 * Create or update a configuration file
 */
export async function POST(req: NextRequest) {
  const denied = await requireConfigAdmin();
  if (denied) return denied;

  let body: {
    competitionType?: string;
    year?: number;
    filename?: string;
    config?: YearConfig;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { config, competitionType, year } = body;

  if (!config) {
    return NextResponse.json({ error: "Missing 'config' object" }, { status: 400 });
  }

  // Validate the YearConfig data structure
  const validation = validateYearConfig(config);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Configuration validation failed",
        errors: validation.errors,
        warnings: validation.warnings,
      },
      { status: 422 },
    );
  }

  const compType = (competitionType || config.competitionType || "FRC").toUpperCase();
  const gameYear = year || new Date().getFullYear();
  const filename = body.filename || `${compType}-${gameYear}.json`;

  if (!/^[a-zA-Z0-9_\-.]+\.json$/.test(filename) || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  try {
    await mkdir(CONFIG_YEARS_DIR, { recursive: true });
    const targetPath = join(CONFIG_YEARS_DIR, filename);

    // Write formatted JSON
    const content = JSON.stringify(config, null, 2) + "\n";
    await writeFile(targetPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      filename,
      warnings: validation.warnings,
      config,
    });
  } catch (err) {
    console.error(`Failed to save config ${filename}:`, err);
    return NextResponse.json({ error: "Failed to write configuration file" }, { status: 500 });
  }
}

/**
 * DELETE /api/scouting/admin/configs?file=...
 * Delete a custom config file
 */
export async function DELETE(req: NextRequest) {
  const denied = await requireConfigAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const filename = url.searchParams.get("file");

  if (!filename) {
    return NextResponse.json({ error: "Missing 'file' parameter" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_\-.]+\.json$/.test(filename) || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const primaryPath = join(CONFIG_YEARS_DIR, filename);
  const runtimePath = join(RUNTIME_CONFIGS_DIR, filename);

  let deleted = false;

  try {
    if (existsSync(primaryPath)) {
      await unlink(primaryPath);
      deleted = true;
    }
    if (existsSync(runtimePath)) {
      await unlink(runtimePath);
      deleted = true;
    }

    if (!deleted) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Deleted ${filename}` });
  } catch (err) {
    console.error(`Failed to delete config ${filename}:`, err);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
