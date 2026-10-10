import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { getDbService } from "@/lib/server/db-service";
import { NextRequest, NextResponse } from "next/server";



// GET /api/scouting/picklist/entries - Get picklist entries
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

    if (!picklistId) {
      return NextResponse.json(
        { error: "Missing required parameter: picklistId" },
        { status: 400 },
      );
    }

    const service = getDbService();
    const entries = await service.getPicklistEntries(parseInt(picklistId));

    return NextResponse.json({
      picklistId,
      entries,
      count: entries.length,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching picklist entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch picklist entries" },
      { status: 500 },
    );
  }
}

// POST /api/scouting/picklist/entries - Add an entry to picklist
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
    const { picklistId, teamNumber, rank } = body;

    if (!picklistId || !teamNumber || rank === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: picklistId, teamNumber, rank" },
        { status: 400 },
      );
    }

    const service = getDbService();
    const entryId = await service.addPicklistEntry({
      picklistId,
      teamNumber,
      rank,
    });

    return NextResponse.json({
      id: entryId,
      picklistId,
      teamNumber,
      rank,
      success: true,
    });
  } catch (error) {
    console.error("Error adding picklist entry:", error);
    return NextResponse.json(
      { error: "Failed to add picklist entry" },
      { status: 500 },
    );
  }
}

// PUT /api/scouting/picklist/entries - Update a picklist entry
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
    const { entryId, rank } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: "Missing required field: entryId" },
        { status: 400 },
      );
    }

    const service = getDbService();
    await service.updatePicklistEntry(entryId, {
      rank,
    });

    return NextResponse.json({
      entryId,
      updated: true,
      success: true,
    });
  } catch (error) {
    console.error("Error updating picklist entry:", error);
    return NextResponse.json(
      { error: "Failed to update picklist entry" },
      { status: 500 },
    );
  }
}

// DELETE /api/scouting/picklist/entries - Remove entry from picklist
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
    const entryId = searchParams.get("entryId");

    if (!entryId) {
      return NextResponse.json(
        { error: "Missing required parameter: entryId" },
        { status: 400 },
      );
    }

    const service = getDbService();
    await service.deletePicklistEntry(parseInt(entryId));

    return NextResponse.json({
      entryId,
      deleted: true,
      success: true,
    });
  } catch (error) {
    console.error("Error deleting picklist entry:", error);
    return NextResponse.json(
      { error: "Failed to delete picklist entry" },
      { status: 500 },
    );
  }
}
