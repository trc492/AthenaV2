import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { DatabaseService, CompetitionType } from "@/lib/types";
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

// GET /api/scouting/entries/pit - Get all pit entries or filter by year/team/event/competitionType
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_PIT_SCOUTING)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")
      ? parseInt(searchParams.get("id")!)
      : undefined;
    const year = searchParams.get("year")
      ? parseInt(searchParams.get("year")!)
      : undefined;
    const teamNumber = searchParams.get("teamNumber")
      ? parseInt(searchParams.get("teamNumber")!)
      : undefined;
    const eventCode = searchParams.get("eventCode") || undefined;
    const competitionType =
      (searchParams.get("competitionType") as CompetitionType) || undefined;

    const service = getDbService();

    if (id) {
      const entries = await service.getAllPitEntries();
      const entry = entries.find((e) => e.id === id);
      if (!entry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json(entry);
    } else if (teamNumber && year) {
      const entry = await service.getPitEntry(teamNumber, year, competitionType);
      return NextResponse.json(entry || null);
    } else {
      const entries = await service.getAllPitEntries(year, eventCode, competitionType);
      return NextResponse.json(entries);
    }
  } catch (error) {
    console.error("Error fetching pit entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch pit entries" },
      { status: 500 },
    );
  }
}

// POST /api/scouting/entries/pit - Add new pit entry
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.CREATE_PIT_SCOUTING)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { scoutingForUserId, ...entry } = body;

    // Tablets with SCOUT_ON_BEHALF permission can submit on behalf of another user
    let actualUserId = session.user.id;
    if (
      scoutingForUserId &&
      hasPermission(session.user.role, PERMISSIONS.SCOUT_ON_BEHALF)
    ) {
      actualUserId = scoutingForUserId;
    }

    const entryWithUser = { ...entry, userId: actualUserId };
    const service = getDbService();

    // Check for duplicate entry
    const existingEntries = await service.getAllPitEntries(
      entryWithUser.year,
      entryWithUser.eventCode,
      entryWithUser.competitionType,
    );
    const duplicate = existingEntries.find(
      (e) =>
        e.teamNumber === entryWithUser.teamNumber &&
        e.eventCode === entryWithUser.eventCode &&
        e.year === entryWithUser.year &&
        e.competitionType === entryWithUser.competitionType,
    );

    if (duplicate) {
      return NextResponse.json(
        {
          error: "Duplicate entry",
          message: `Pit scouting entry already exists for team ${entryWithUser.teamNumber} at this event`,
        },
        { status: 409 },
      );
    }

    const id = await service.addPitEntry(entryWithUser);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Error adding pit entry:", error);
    return NextResponse.json(
      { error: "Failed to add pit entry" },
      { status: 500 },
    );
  }
}

// PUT /api/scouting/entries/pit - Update pit entry
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_PIT_SCOUTING)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id, ...updates } = await request.json();
    const service = getDbService();

    const entries = await service.getAllPitEntries();
    const existingEntry = entries.find((e) => e.id === id);

    if (!existingEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Users can only edit their own entries; OVERRIDE_PIT_SCOUTING grants edit-any rights
    const isOwner = existingEntry.userId === session.user.id;
    const canEditAny = hasPermission(
      session.user.role,
      PERMISSIONS.OVERRIDE_PIT_SCOUTING,
    );

    if (!isOwner && !canEditAny) {
      return NextResponse.json(
        { error: "Forbidden - can only edit your own entries" },
        { status: 403 },
      );
    }

    await service.updatePitEntry(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating pit entry:", error);
    return NextResponse.json(
      { error: "Failed to update pit entry" },
      { status: 500 },
    );
  }
}

// DELETE /api/scouting/entries/pit - Delete pit entry
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.DELETE_PIT_SCOUTING)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id")!);
    const service = getDbService();
    await service.deletePitEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pit entry:", error);
    return NextResponse.json(
      { error: "Failed to delete pit entry" },
      { status: 500 },
    );
  }
}
