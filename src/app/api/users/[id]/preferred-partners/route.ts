import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";
import { hasAnyPermission, PERMISSIONS } from "@/lib/auth/roles";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PUT /api/users/[id]/preferred-partners
// Lead scouts and admins can update preferred partners ("friends") for any user.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const allowedPermissions = [PERMISSIONS.EDIT_USERS];

    if (
      !session?.user?.role ||
      !hasAnyPermission(session.user.role, allowedPermissions)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    const body = await request.json();
    const { preferredPartners } = body;

    if (!Array.isArray(preferredPartners)) {
      return NextResponse.json(
        { error: "preferredPartners must be an array of user IDs" },
        { status: 400 },
      );
    }

    if (preferredPartners.includes(targetUserId)) {
      return NextResponse.json(
        { error: "Cannot add the user as their own preferred partner" },
        { status: 400 },
      );
    }

    const service = databaseManager.getService();

    // Ensure target user exists (where supported)
    if (service.users) {
      const existingUser = await service.users.getById(targetUserId);
      if (!existingUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Best-effort validation that referenced partner IDs exist.
      // If some IDs are invalid, return 400 with a list.
      if (preferredPartners.length > 0) {
        const uniqueIds = Array.from(new Set(preferredPartners));
        const partnerRows = await service.users.getByIds(uniqueIds, true);
        const existingIds = new Set(partnerRows.map((user) => user.id));
        const missingIds = uniqueIds.filter((pid) => !existingIds.has(pid));

        if (missingIds.length > 0) {
          return NextResponse.json(
            {
              error: "One or more preferredPartners user IDs do not exist",
              missingIds,
            },
            { status: 400 },
          );
        }
      }
    }

    await service.updateUserPreferredPartners(targetUserId, preferredPartners);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user preferred partners:", error);
    return NextResponse.json(
      { error: "Failed to update preferred partners" },
      { status: 500 },
    );
  }
}
