import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { DatabaseService } from "@/lib/types";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";


function getDbService(): DatabaseService {
  return databaseManager.getService();
}

// GET /api/scouting/picklist/notes - Get picklist notes for a team or all
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const picklistId = searchParams.get("picklistId");
    const teamNumber = searchParams.get("teamNumber")
      ? parseInt(searchParams.get("teamNumber")!)
      : undefined;

    if (!picklistId) {
      return NextResponse.json(
        { error: "Missing required parameter: picklistId" },
        { status: 400 },
      );
    }

    const service = getDbService();
    const notes = await service.getPicklistNotes(
      parseInt(picklistId),
      teamNumber,
    );

    return NextResponse.json({
      picklistId,
      teamNumber,
      notes,
      count: notes.length,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching picklist notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch picklist notes" },
      { status: 500 },
    );
  }
}

// POST /api/scouting/picklist/notes - Add a note to a team's picklist
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { picklistId, teamNumber, note } = body;

    if (!picklistId || !teamNumber || !note) {
      return NextResponse.json(
        { error: "Missing required fields: picklistId, teamNumber, note" },
        { status: 400 },
      );
    }

    const service = getDbService();
    const noteId = await service.addPicklistNote({
      picklistId,
      teamNumber,
      note,
    });

    return NextResponse.json({
      id: noteId,
      picklistId,
      teamNumber,
      note,
      created_at: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error("Error adding picklist note:", error);
    return NextResponse.json(
      { error: "Failed to add picklist note" },
      { status: 500 },
    );
  }
}

// PUT /api/scouting/picklist/notes - Update a picklist note
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { noteId, note, picklistId, teamNumber } = body;

    if (!note) {
      return NextResponse.json(
        { error: "Missing required field: note" },
        { status: 400 },
      );
    }

    const service = getDbService();

    // If explicit noteId provided, update that note
    if (noteId) {
      await service.updatePicklistNote(noteId, { note });
      return NextResponse.json({ noteId, updated: true, success: true });
    }

    // Otherwise, if picklistId + teamNumber provided, try to upsert (update first existing note, else create)
    if (picklistId && teamNumber) {
      const pid = Number(picklistId);
      const tnum = Number(teamNumber);
      const existing = await service.getPicklistNotes(pid, tnum);
      if (
        existing &&
        existing.length > 0 &&
        typeof existing[0].id === "number"
      ) {
        const idToUpdate = existing[0].id;
        await service.updatePicklistNote(idToUpdate, { note });
        return NextResponse.json({
          noteId: idToUpdate,
          updated: true,
          success: true,
        });
      }

      const createdId = await service.addPicklistNote({
        picklistId: pid,
        teamNumber: tnum,
        note,
      });
      return NextResponse.json({ id: createdId, created: true, success: true });
    }

    return NextResponse.json(
      {
        error: "Missing required fields: noteId or (picklistId and teamNumber)",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating picklist note:", error);
    return NextResponse.json(
      { error: "Failed to update picklist note" },
      { status: 500 },
    );
  }
}

// DELETE /api/scouting/picklist/notes - Delete a picklist note
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_PICKLIST)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");
    const picklistId = searchParams.get("picklistId");
    const teamNumber = searchParams.get("teamNumber");

    const service = getDbService();

    // Delete by explicit noteId
    if (noteId) {
      await service.deletePicklistNote(parseInt(noteId));
      return NextResponse.json({ noteId, deleted: true, success: true });
    }

    // Or delete all notes for a picklistId + teamNumber
    if (picklistId && teamNumber) {
      const pid = parseInt(picklistId);
      const tnum = parseInt(teamNumber);
      const existing = await service.getPicklistNotes(pid, tnum);
      for (const n of existing) {
        if (typeof n.id === "number") {
          await service.deletePicklistNote(n.id);
        }
      }
      return NextResponse.json({
        picklistId: pid,
        teamNumber: tnum,
        deleted: true,
        success: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "Missing required parameter: noteId or (picklistId and teamNumber)",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error deleting picklist note:", error);
    return NextResponse.json(
      { error: "Failed to delete picklist note" },
      { status: 500 },
    );
  }
}
