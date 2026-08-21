import { NextRequest, NextResponse } from "next/server";
import { databaseManager } from "@/db/database-manager";
import { auth } from "@/lib/auth/config";
import { hasPermission, hasAnyPermission, PERMISSIONS } from "@/lib/auth/roles";
import { createUser } from "@/lib/server/user-service";

export async function GET() {
  try {
    // Check if user has permission to view users
    // VIEW_USERS: full user management access
    // VIEW_SCHEDULE_USERS: limited access for schedule assignments
    // SCOUT_ON_BEHALF: tablets need to see user list for scout selection
    const session = await auth();
    const allowedPermissions = [
      PERMISSIONS.VIEW_USERS,
      PERMISSIONS.SCOUT_ON_BEHALF,
    ];
    if (
      !session?.user?.role ||
      !hasAnyPermission(session.user.role, allowedPermissions)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const db = databaseManager.getService();
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service does not support direct SQL queries" },
        { status: 500 },
      );
    }
    const result = await db.query<{
      id: string;
      name: string;
      username: string;
      role: string;
      preferredPartners: string | null;
      created_at: string;
      updated_at: string;
    }>(`
        SELECT id, name, username, role, preferredPartners, created_at, updated_at
        FROM users
        ORDER BY name ASC
      `);

    const users = result.recordset.map((user: any) => {
      let preferredPartners: string[] = [];
      if (user.preferredPartners) {
        try {
          preferredPartners = JSON.parse(user.preferredPartners);
        } catch {
          preferredPartners = [];
        }
      }

      return {
        id: user.id.toString(),
        name: user.name,
        username: user.username,
        role: user.role,
        preferredPartners,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user has permission to create users
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.CREATE_USERS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, username, password, role = "scout" } = await request.json();

    const result = await createUser({
      name,
      username,
      password,
      role,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      { message: "User created successfully", userId: result.userId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
