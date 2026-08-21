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
      created_at: string;
      updated_at: string;
    }>(`
        SELECT id, name, username, role, created_at, updated_at
        FROM users
        WHERE id = @id
      `, { id });

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result.recordset[0];
    const userData = {
      id: user.id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
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
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      if (!usernameRegex.test(username)) {
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
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service does not support direct SQL queries" },
        { status: 500 },
      );
    }
    // Check if user exists
    const existingUserResult = await db.query<{ id: string; username: string }>(
      "SELECT id, username FROM users WHERE id = @id",
      { id },
    );

    if (existingUserResult.recordset.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingUser = existingUserResult.recordset[0];

    // Check if username is already taken by another user
    if (username && username !== existingUser.username) {
      const usernameCheckResult = await db.query<{ id: string }>(
        "SELECT id FROM users WHERE username = @username AND id != @userId",
        { username, userId: id },
      );

      if (usernameCheckResult.recordset.length > 0) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 409 },
        );
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const requestInputs = [];

    if (name) {
      updateFields.push("name = @name");
      requestInputs.push({ name: "name", value: name });
    }
    if (username) {
      updateFields.push("username = @username");
      requestInputs.push({ name: "username", value: username });
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updateFields.push("password_hash = @passwordHash");
      requestInputs.push({ name: "passwordHash", value: hashedPassword });
    }
    if (role) {
      updateFields.push("role = @role");
      requestInputs.push({ name: "role", value: role });
    }

    updateFields.push("updated_at = GETDATE()");

    const updateParams: Record<string, unknown> = { userId: id };
    requestInputs.forEach((input) => {
      updateParams[input.name] = input.value;
    });

    await db.query(
      `
      UPDATE users
      SET ${updateFields.join(", ")}
      WHERE id = @userId
      `,
      updateParams,
    );

    return NextResponse.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Check if user has permission to delete users
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.DELETE_USERS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent users from deleting themselves
    if (session.user.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    const db = databaseManager.getService();
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service does not support direct SQL queries" },
        { status: 500 },
      );
    }
    // Check if user exists
    const existingUserResult = await db.query<{ id: string }>(
      "SELECT id FROM users WHERE id = @id",
      { id },
    );

    if (existingUserResult.recordset.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete user (this will cascade to team_permissions due to foreign key constraint)
    await db.query("DELETE FROM users WHERE id = @id", { id });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
