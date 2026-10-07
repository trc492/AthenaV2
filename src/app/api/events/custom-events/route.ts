import { guestDatabase } from "@/lib/server/guest-database";
import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { CustomEvent, DatabaseService, CompetitionType } from "@/lib/types";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";

// Resolve the active provider on each request so configuration changes take effect.
function getDbService(): DatabaseService {
  return databaseManager.getService();
}

// GET /api/events/custom-events - Get all custom events or filter by year
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_DASHBOARD)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const eventCode = searchParams.get("eventCode") || undefined;
    const competitionType =
      (searchParams.get("competitionType") as CompetitionType) || undefined;

    const service = guestDatabase(getDbService(), session);

    if (eventCode) {
      const event = await service.getCustomEvent(eventCode, competitionType);
      if (!event) {
        return NextResponse.json(
          { error: "Custom event not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(event);
    } else {
      const events = await service.getAllCustomEvents(year, competitionType);
      return NextResponse.json(events);
    }
  } catch (error) {
    console.error("Error fetching custom events:", error);
    return NextResponse.json(
      { error: "Failed to fetch custom events" },
      { status: 500 },
    );
  }
}

// POST /api/events/custom-events - Add new custom event
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.MANAGE_EVENT_SETTINGS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const event: Omit<CustomEvent, "id"> = await request.json();
    const service = getDbService();
    const id = await service.addCustomEvent(event);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Error adding custom event:", error);
    return NextResponse.json(
      { error: "Failed to add custom event" },
      { status: 500 },
    );
  }
}

// PUT /api/events/custom-events - Update custom event
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.MANAGE_EVENT_SETTINGS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { eventCode, ...updates } = await request.json();

    if (!eventCode) {
      return NextResponse.json(
        { error: "eventCode is required" },
        { status: 400 },
      );
    }

    const service = getDbService();
    await service.updateCustomEvent(eventCode, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating custom event:", error);
    return NextResponse.json(
      { error: "Failed to update custom event" },
      { status: 500 },
    );
  }
}

// DELETE /api/events/custom-events - Delete custom event
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.MANAGE_EVENT_SETTINGS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const eventCode = searchParams.get("eventCode");

    if (!eventCode) {
      return NextResponse.json(
        { error: "eventCode parameter is required" },
        { status: 400 },
      );
    }

    const service = getDbService();
    await service.deleteCustomEvent(eventCode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting custom event:", error);
    return NextResponse.json(
      { error: "Failed to delete custom event" },
      { status: 500 },
    );
  }
}
