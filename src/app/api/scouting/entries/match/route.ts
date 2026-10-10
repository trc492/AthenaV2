import { requirePermissionWithSession } from "@/lib/server/require-permission";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { getDbService } from "@/lib/server/db-service";
import { guestDatabase } from "@/lib/server/guest-database";
import { createMatchSchema, parseScoutingBody, updateMatchSchema } from "@/lib/server/scouting-schema";
import { ScoutingError, ScoutingService } from "@/lib/server/scouting-service";
import { CompetitionType } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";


// GET /api/scouting/entries/match - Get all match entries or filter by team/year/event/competitionType
export async function GET(request: NextRequest) {
  try {
    const access = await requirePermissionWithSession(PERMISSIONS.VIEW_MATCH_SCOUTING);
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

    // If ID is provided, fetch single entry by ID
    if (id) {
      const entries = await service.getAllMatchEntries();
      const entry = entries.find((e) => e.id === id);
      if (!entry) {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      return NextResponse.json(entry);
    } else if (teamNumber) {
      const entries = await service.getMatchEntries(
        teamNumber,
        year,
        competitionType,
      );
      return NextResponse.json(entries);
    } else {
      const entries = await service.getAllMatchEntries(
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
    console.error("Error fetching match entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch match entries" },
      { status: 500 },
    );
  }
}

// POST /api/scouting/entries/match - Add new match entry
export async function POST(request: NextRequest) {
  try {
    const access = await requirePermissionWithSession(PERMISSIONS.CREATE_MATCH_SCOUTING);
    if (access.denied) return access.denied;
    const { session } = access;

    const parsed = await parseScoutingBody(request, createMatchSchema);
    if (parsed.error) return parsed.error;
    const { scoutingForUserId, ...entry } = parsed.data;
    const grant = session.guestEvent;
    if (session.user.role === "guest" && (!grant?.canAddScouting || grant.expiresAt <= Date.now() || entry.eventCode !== grant.eventCode || entry.year !== grant.year || entry.competitionType !== grant.competitionType)) {
      return NextResponse.json({ error: "Forbidden - outside guest event scope" }, { status: 403 });
    }
    const userId = scoutingForUserId && hasPermission(session.user.role, PERMISSIONS.SCOUT_ON_BEHALF)
      ? scoutingForUserId : session.user.id;
    const id = await new ScoutingService(getDbService()).createMatch({ ...entry, userId });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof ScoutingError) return NextResponse.json(
      { error: error.message, message: error.message }, { status: error.status },
    );
    console.error("Error adding match entry:", error);
    return NextResponse.json(
      { error: "Failed to add match entry" },
      { status: 500 },
    );
  }
}

// PUT /api/scouting/entries/match - Update match entry
export async function PUT(request: NextRequest) {
  try {
    const access = await requirePermissionWithSession(PERMISSIONS.EDIT_MATCH_SCOUTING);
    if (access.denied) return access.denied;
    const { session } = access;

    const parsed = await parseScoutingBody(request, updateMatchSchema);
    if (parsed.error) return parsed.error;
    const { id, ...updates } = parsed.data;
    await new ScoutingService(getDbService()).updateMatch(id, updates, {
      userId: session.user.id,
      canEditAny: hasPermission(session.user.role, PERMISSIONS.OVERRIDE_MATCH_SCOUTING),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ScoutingError) return NextResponse.json(
      { error: error.message, message: error.message }, { status: error.status },
    );
    console.error("Error updating match entry:", error);
    return NextResponse.json(
      { error: "Failed to update match entry" },
      { status: 500 },
    );
  }
}

// DELETE /api/scouting/entries/match - Delete match entry
export async function DELETE(request: NextRequest) {
  try {
    const access = await requirePermissionWithSession(PERMISSIONS.DELETE_MATCH_SCOUTING);
    if (access.denied) return access.denied;

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Valid entry ID is required" },
        { status: 400 },
      );
    }

    const service = getDbService();
    await service.deleteMatchEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ScoutingError) return NextResponse.json(
      { error: error.message, message: error.message }, { status: error.status },
    );
    console.error("Error deleting match entry:", error);
    return NextResponse.json(
      { error: "Failed to delete match entry" },
      { status: 500 },
    );
  }
}
