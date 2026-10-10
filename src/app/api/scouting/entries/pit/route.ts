import { requirePermissionWithSession } from "@/lib/server/require-permission";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { getDbService } from "@/lib/server/db-service";
import { guestDatabase } from "@/lib/server/guest-database";
import { createPitSchema, parseScoutingBody, updatePitSchema } from "@/lib/server/scouting-schema";
import { ScoutingError, ScoutingService } from "@/lib/server/scouting-service";
import { CompetitionType } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";


// GET /api/scouting/entries/pit - Get all pit entries or filter by year/team/event/competitionType
export async function GET(request: NextRequest) {
  try {
    const access = await requirePermissionWithSession(PERMISSIONS.VIEW_PIT_SCOUTING);
    if (access.denied) return access.denied;
    const { session } = access;

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

    const service = guestDatabase(getDbService(), session);

    if (id) {
      const entries = await service.getAllPitEntries();
      const entry = entries.find((e) => e.id === id);
      if (!entry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json(entry);
    } else if (teamNumber && year) {
      const entry = await service.getPitEntry(
        teamNumber,
        year,
        competitionType,
      );
      return NextResponse.json(entry || null);
    } else {
      const entries = await service.getAllPitEntries(
        year,
        eventCode,
        competitionType,
      );
      return NextResponse.json(entries);
    }
  } catch (error) {
    if (error instanceof ScoutingError) return NextResponse.json(
      { error: error.message, message: error.message }, { status: error.status },
    );
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
    const access = await requirePermissionWithSession(PERMISSIONS.CREATE_PIT_SCOUTING);
    if (access.denied) return access.denied;
    const { session } = access;

    const parsed = await parseScoutingBody(request, createPitSchema);
    if (parsed.error) return parsed.error;
    const { scoutingForUserId, ...entry } = parsed.data;
    const grant = session.guestEvent;
    if (session.user.role === "guest" && (!grant?.canAddScouting || grant.expiresAt <= Date.now() || entry.eventCode !== grant.eventCode || entry.year !== grant.year || entry.competitionType !== grant.competitionType)) {
      return NextResponse.json({ error: "Forbidden - outside guest event scope" }, { status: 403 });
    }
    const userId = scoutingForUserId && hasPermission(session.user.role, PERMISSIONS.SCOUT_ON_BEHALF)
      ? scoutingForUserId : session.user.id;
    const id = await new ScoutingService(getDbService()).createPit({ ...entry, userId });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof ScoutingError) return NextResponse.json(
      { error: error.message, message: error.message }, { status: error.status },
    );
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
    const access = await requirePermissionWithSession(PERMISSIONS.EDIT_PIT_SCOUTING);
    if (access.denied) return access.denied;
    const { session } = access;

    const parsed = await parseScoutingBody(request, updatePitSchema);
    if (parsed.error) return parsed.error;
    const { id, ...updates } = parsed.data;
    await new ScoutingService(getDbService()).updatePit(id, updates, {
      userId: session.user.id,
      canEditAny: hasPermission(session.user.role, PERMISSIONS.OVERRIDE_PIT_SCOUTING),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ScoutingError) return NextResponse.json(
      { error: error.message, message: error.message }, { status: error.status },
    );
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
    const access = await requirePermissionWithSession(PERMISSIONS.DELETE_PIT_SCOUTING);
    if (access.denied) return access.denied;

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Valid entry ID is required" }, { status: 400 });
    }
    const service = getDbService();
    await service.deletePitEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ScoutingError) return NextResponse.json(
      { error: error.message, message: error.message }, { status: error.status },
    );
    console.error("Error deleting pit entry:", error);
    return NextResponse.json(
      { error: "Failed to delete pit entry" },
      { status: 500 },
    );
  }
}
