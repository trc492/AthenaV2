import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";

const scopeSchema = z.object({
  eventCode: z.string().trim().min(1).max(50),
  year: z.coerce.number().int().min(1992).max(2100),
  competitionType: z.enum(["FRC", "FTC"]),
});

const changeSchema = z
  .object({
    startMatch: z.coerce.number().int().min(1).max(500),
    endMatch: z.coerce.number().int().min(1).max(500),
    alliance: z.enum(["red", "blue"]),
    position: z.coerce.number().int().min(0).max(2),
    userId: z.string().min(1).max(255).nullable(),
  })
  .refine((change) => change.endMatch >= change.startMatch, {
    message: "endMatch must be greater than or equal to startMatch",
  });

const assignmentRecordSchema = z.object({
  matchNumber: z.coerce.number().int().min(1).max(500),
  alliance: z.enum(["red", "blue"]),
  position: z.coerce.number().int().min(0).max(2),
  userId: z.string().min(1).max(255),
});

const requestSchema = scopeSchema.extend({
  startMatch: z.unknown().optional(),
  endMatch: z.unknown().optional(),
  alliance: z.unknown().optional(),
  position: z.unknown().optional(),
  userId: z.unknown().optional(),
  changes: z.array(changeSchema).max(3000).optional(),
  expectedAssignments: z.array(assignmentRecordSchema).max(3000).optional(),
  replaceAll: z.boolean().optional().default(false),
});

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !hasPermission(session.user.role ?? null, PERMISSIONS.CREATE_SCHEDULE) &&
      !hasPermission(session.user.role ?? null, PERMISSIONS.EDIT_SCHEDULE)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid schedule assignment request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { eventCode, year, competitionType, replaceAll } = parsed.data;
    const hasSingleFields = [
      parsed.data.startMatch,
      parsed.data.endMatch,
      parsed.data.alliance,
      parsed.data.position,
    ].some((value) => value !== undefined);
    if (parsed.data.changes && hasSingleFields) {
      return NextResponse.json(
        { error: "Provide either one assignment range or a changes array" },
        { status: 400 },
      );
    }

    let changes = parsed.data.changes;
    if (!changes) {
      const single = changeSchema.safeParse({
        startMatch: parsed.data.startMatch,
        endMatch: parsed.data.endMatch,
        alliance: parsed.data.alliance,
        position: parsed.data.position,
        userId: parsed.data.userId ?? null,
      });
      if (!single.success) {
        return NextResponse.json(
          { error: "A valid assignment range is required", details: single.error.flatten() },
          { status: 400 },
        );
      }
      changes = [single.data];
    }

    const maxPosition = competitionType === "FTC" ? 1 : 2;
    if (changes.some((change) => change.position > maxPosition)) {
      return NextResponse.json(
        { error: `position must be between 0 and ${maxPosition} for ${competitionType}` },
        { status: 400 },
      );
    }
    const expandedRowCount = changes.reduce(
      (count, change) => count + change.endMatch - change.startMatch + 1,
      0,
    );
    if (expandedRowCount > 3000) {
      return NextResponse.json(
        { error: "A schedule update may contain at most 3000 match slots" },
        { status: 400 },
      );
    }
    const touchedSlots = new Set<string>();
    for (const change of changes) {
      for (let matchNumber = change.startMatch; matchNumber <= change.endMatch; matchNumber++) {
        const key = `${matchNumber}-${change.alliance}-${change.position}`;
        if (touchedSlots.has(key)) {
          return NextResponse.json(
            { error: `Overlapping assignment changes for ${key}` },
            { status: 400 },
          );
        }
        touchedSlots.add(key);
      }
    }

    const service = databaseManager.getService();
    if (!service.query || !service.applyScheduleAssignmentChanges) {
      return NextResponse.json(
        { error: "Schedule assignments require a SQL-backed provider" },
        { status: 501 },
      );
    }

    const userIds = [
      ...new Set(changes.map((change) => change.userId).filter(Boolean)),
    ] as string[];
    for (const userId of userIds) {
      const result = await service.query<{ id: string }>(
        "SELECT id FROM users WHERE id = @userId",
        { userId },
      );
      if (!result.recordset?.length) {
        return NextResponse.json(
          { error: `Unknown scout: ${userId}` },
          { status: 400 },
        );
      }
    }

    await service.applyScheduleAssignmentChanges(
      { eventCode, year, competitionType },
      changes,
      replaceAll,
      parsed.data.expectedAssignments,
    );

    return NextResponse.json(
      { success: true },
      { status: 200, headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ScheduleConflictError") {
      return NextResponse.json(
        { error: error.message },
        { status: 409, headers: noStoreHeaders },
      );
    }
    console.error("Error saving schedule assignments:", error);
    return NextResponse.json(
      { error: "Failed to save schedule assignments" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasPermission(session.user.role ?? null, PERMISSIONS.DELETE_SCHEDULE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const parsed = scopeSchema.safeParse({
      eventCode: params.get("eventCode"),
      year: params.get("year"),
      competitionType: params.get("competitionType"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid eventCode, year, and competitionType are required" },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();
    if (!service.applyScheduleAssignmentChanges) {
      return NextResponse.json(
        { error: "Schedule assignments require a SQL-backed provider" },
        { status: 501 },
      );
    }
    await service.applyScheduleAssignmentChanges(parsed.data, [], true);

    return NextResponse.json(
      { success: true },
      { status: 200, headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Error clearing schedule assignments:", error);
    return NextResponse.json(
      { error: "Failed to clear schedule assignments" },
      { status: 500 },
    );
  }
}
