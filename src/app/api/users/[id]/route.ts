import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";
import { auth } from "@/lib/auth/config";
import {
  hasPermission,
  hasAnyPermission,
  PERMISSIONS,
  ROLES,
} from "@/lib/auth/roles";
import { USERNAME_REGEX } from "@/lib/server/user-service";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Check if user has permission to view users
    // VIEW_USERS: full user management access
    // VIEW_SCHEDULE_USERS: limited access for schedule assignments
    // SCOUT_ON_BEHALF: tablets need to see user info for scout selection
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

    const { id } = await params;

    const db = databaseManager.getService();
    if (!db.users) {
      return NextResponse.json(
        { error: "User management is not supported by this database provider" },
        { status: 500 },
      );
    }
    const user = await db.users.getById(id);
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (
      user.deactivatedAt &&
      !hasPermission(session.user.role, PERMISSIONS.DELETE_USERS)
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userData = {
      id: user.id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
      deactivatedAt: user.deactivatedAt,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    return NextResponse.json({ user: userData });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Check if user has permission to edit users
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.EDIT_USERS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { name, username, password, role } = await request.json();

    // Validate that at least one field is provided
    if (!name && !username && !password && !role) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 },
      );
    }

    // Validate username format if provided
    if (username) {
      if (!USERNAME_REGEX.test(username)) {
        return NextResponse.json(
          {
            error:
              "Username must be 3-20 characters and contain only letters, numbers, underscores, or dashes",
          },
          { status: 400 },
        );
      }
    }

    // Validate password strength if provided
    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    // Validate role if provided
    if (role) {
      const validRoles = Object.values(ROLES);
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: "Invalid role specified" },
          { status: 400 },
        );
      }
    }

    const db = databaseManager.getService();
    if (!db.users) {
      return NextResponse.json(
        { error: "User management is not supported by this database provider" },
        { status: 500 },
      );
    }
    // Check if user exists
    const existingUser = await db.users.getById(id);
    if (!existingUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (username && username !== existingUser.username) {
      const match = await db.users.getByUsername(username);
      if (match && match.id !== id) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 409 },
        );
      }
    }

    // Build updates object and delegate SQL to the provider
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (username) updates.username = username;
    if (password) updates.passwordHash = await bcrypt.hash(password, 12);
    if (role) updates.role = role;

    await db.updateUser(id, updates);

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE now deactivates instead of destroying the account and its attribution.
export async function DELETE(request: NextRequest, context: RouteParams) {
  return setAccountActive(context, false);
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const body = await request.json();
    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        { error: "active must be a boolean" },
        { status: 400 },
      );
    }
    return setAccountActive(context, body.active);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

async function setAccountActive({ params }: RouteParams, active: boolean) {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.DELETE_USERS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const { id } = await params;
    if (!active && session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 },
      );
    }
    const db = databaseManager.getService();
    if (!db.users)
      return NextResponse.json(
        { error: "User management is not supported by this database provider" },
        { status: 500 },
      );
    if (!(await db.users.getById(id)))
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    // Account transitions invalidate old sessions, even after restoration.
    await db.users.setActive(id, active);
    return NextResponse.json({
      message: active
        ? "User restored successfully"
        : "User deactivated successfully",
    });
  } catch (error) {
    console.error("Change user status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
