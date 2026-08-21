import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";

async function sendAssignmentNotification(params: {
  title: string;
  body: string;
  url: string;
  targetUserId?: string;
}) {
  try {
    const { title, body, url, targetUserId } = params;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (!baseUrl) {
      // No base URL configured; skip quietly (avoids breaking schedule writes)
      return;
    }

    let targetEndpoint: string | undefined;

    if (targetUserId) {
      const service = databaseManager.getService();
      if (!service.query) return;

      const result = await service.query<{ push_subscriptions: string | null }>(
        "SELECT push_subscriptions FROM users WHERE id = @userId",
        { userId: targetUserId },
      );

      const raw = result.recordset?.[0]?.push_subscriptions;
      if (raw) {
        try {
          const subs: Array<{ endpoint: string }> = JSON.parse(raw);
          targetEndpoint = subs?.[0]?.endpoint;
        } catch {
          // ignore parse errors 👍
        }
      }

      if (!targetEndpoint) {
        return;
      }
    }

    await fetch(`${baseUrl.replace(/\/$/, "")}/api/notifications/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward cookies so /api/notifications/send sees the same session
        Cookie: (await import("next/headers")).cookies().toString(),
      },
      body: JSON.stringify({
        payload: {
          title,
          body,
          url,
          icon: "/TRCLogo.webp",
          badge: "/TRCLogo.webp",
          data: { timestamp: new Date().toISOString() },
        },
        targetEndpoint,
      }),
    });
  } catch (error) {
    // Never fail schedule updates due to notification issues
    console.error("Failed to send assignment notification:", error);
  }
}

// POST /api/schedule/assignments
// Body: { eventCode, year, startMatch, endMatch, alliance, position, userId }
// - If userId is null, clears that slot for the range
// - Otherwise overwrites that slot for the range to that user
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      eventCode,
      year,
      startMatch,
      endMatch,
      userId,
      alliance,
      position,
    } = body;

    if (
      !eventCode ||
      year === undefined ||
      startMatch === undefined ||
      endMatch === undefined ||
      !alliance ||
      position === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "eventCode, year, startMatch, endMatch, alliance, and position are required",
        },
        { status: 400 },
      );
    }

    if (
      !hasPermission(session.user.role ?? null, PERMISSIONS.CREATE_SCHEDULE) &&
      !hasPermission(session.user.role ?? null, PERMISSIONS.EDIT_SCHEDULE)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["red", "blue"].includes(alliance)) {
      return NextResponse.json(
        { error: 'alliance must be "red" or "blue"' },
        { status: 400 },
      );
    }

    const yearNum = parseInt(year);
    const start = parseInt(startMatch);
    const end = parseInt(endMatch);
    const positionNum = parseInt(position);

    if (
      Number.isNaN(yearNum) ||
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      Number.isNaN(positionNum)
    ) {
      return NextResponse.json(
        { error: "year/startMatch/endMatch/position must be numbers" },
        { status: 400 },
      );
    }

    if (start <= 0 || end < start) {
      return NextResponse.json(
        { error: "startMatch must be > 0 and endMatch must be >= startMatch" },
        { status: 400 },
      );
    }

    if (positionNum < 0) {
      return NextResponse.json(
        { error: "position must be a non-negative integer" },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();
    if (!service.query) {
      return NextResponse.json(
        { error: "Schedule assignments require a SQL-backed provider" },
        { status: 400 },
      );
    }

    // Always delete first (overwrite semantics)
    await service.query(
      `
        DELETE FROM matchAssignments
        WHERE eventCode = @eventCode
          AND year = @year
          AND matchNumber BETWEEN @startMatch AND @endMatch
          AND alliance = @alliance
          AND position = @position
      `,
      {
        eventCode,
        year: yearNum,
        startMatch: start,
        endMatch: end,
        alliance,
        position: positionNum,
      },
    );

    if (userId !== null && userId !== undefined && userId !== "") {
      const values: string[] = [];
      for (let matchNumber = start; matchNumber <= end; matchNumber++) {
        values.push(
          `(@eventCode, @year, ${matchNumber}, @alliance, @position, @userId)`,
        );
      }

      await service.query(
        `
          INSERT INTO matchAssignments (eventCode, year, matchNumber, alliance, position, userId)
          VALUES ${values.join(", ")}
        `,
        {
          eventCode,
          year: yearNum,
          alliance,
          position: positionNum,
          userId,
        },
      );

      // Notifications are triggered based on match timing (e.g., 2 matches before),
      // not when the assignment is created.
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error saving schedule assignments:", error);
    return NextResponse.json(
      { error: "Failed to save schedule assignments" },
      { status: 500 },
    );
  }
}

// DELETE /api/schedule/assignments?eventCode=xxx&year=2025 - clear all assignments for an event
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !hasPermission(session.user.role ?? null, PERMISSIONS.DELETE_SCHEDULE)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const eventCode = searchParams.get("eventCode");
    const yearRaw = searchParams.get("year");

    if (!eventCode || !yearRaw) {
      return NextResponse.json(
        { error: "eventCode and year are required" },
        { status: 400 },
      );
    }

    const year = parseInt(yearRaw);
    if (Number.isNaN(year)) {
      return NextResponse.json(
        { error: "year must be a number" },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();

    if (service.query) {
      await service.query(
        "DELETE FROM matchAssignments WHERE eventCode = @eventCode AND year = @year",
        { eventCode, year },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing schedule assignments:", error);
    return NextResponse.json(
      { error: "Failed to clear schedule assignments" },
      { status: 500 },
    );
  }
}
