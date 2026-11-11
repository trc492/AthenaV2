import { scoutingQuery, scoutingRoute } from "@/lib/server/scouting-route";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { getDbService } from "@/lib/server/db-service";
import { guestDatabase } from "@/lib/server/guest-database";
import { createPitSchema, parseScoutingBody, updatePitSchema } from "@/lib/server/scouting-schema";
import { ScoutingService } from "@/lib/server/scouting-service";
import { NextResponse } from "next/server";

// GET /api/scouting/entries/pit - Get all pit entries or filter by year/team/event/competitionType
export const GET = scoutingRoute(
  PERMISSIONS.VIEW_PIT_SCOUTING,
  "Failed to fetch pit entries",
  async (request, session) => {
    const { id, year, teamNumber, eventCode, competitionType } = scoutingQuery(request);

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
  },
);

// POST /api/scouting/entries/pit - Add new pit entry
export const POST = scoutingRoute(
  PERMISSIONS.CREATE_PIT_SCOUTING,
  "Failed to add pit entry",
  async (request, session) => {
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
  },
);

// PUT /api/scouting/entries/pit - Update pit entry
export const PUT = scoutingRoute(
  PERMISSIONS.EDIT_PIT_SCOUTING,
  "Failed to update pit entry",
  async (request, session) => {
    const parsed = await parseScoutingBody(request, updatePitSchema);
    if (parsed.error) return parsed.error;
    const { id, ...updates } = parsed.data;
    await new ScoutingService(getDbService()).updatePit(id, updates, {
      userId: session.user.id,
      canEditAny: hasPermission(session.user.role, PERMISSIONS.OVERRIDE_PIT_SCOUTING),
    });
    return NextResponse.json({ success: true });
  },
);

// DELETE /api/scouting/entries/pit - Delete pit entry
export const DELETE = scoutingRoute(
  PERMISSIONS.DELETE_PIT_SCOUTING,
  "Failed to delete pit entry",
  async (request) => {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Valid entry ID is required" }, { status: 400 });
    }
    const service = getDbService();
    await service.deletePitEntry(id);
    return NextResponse.json({ success: true });
  },
);
