import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      avatarUrl: string | null;
    }>(`
        SELECT id, name, username, role, avatarUrl
        FROM users
        WHERE id = @userId
      `, { userId: session.user.id });

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = result.recordset[0];
    return NextResponse.json({
      id: user.id.toString(),
      name: user.name,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, username } = await request.json();

    // Validate input
    if (!name?.trim() || !username?.trim()) {
      return NextResponse.json(
        { error: "Name and username are required" },
        { status: 400 },
      );
    }

    // Validate username format
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

    const db = databaseManager.getService();
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service does not support direct SQL queries" },
        { status: 500 },
      );
    }
    // Check if username is already taken by another user
    const existingUser = await db.query<{ id: string }>(`
        SELECT id FROM users
        WHERE username = @username AND id != @userId
      `, { username, userId: session.user.id });

    if (existingUser.recordset.length > 0) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }

    // Update the user
    await db.query(
      `
        UPDATE users
        SET name = @name, username = @username, updated_at = GETDATE()
        WHERE id = @userId
      `,
      { name: name.trim(), username: username.trim(), userId: session.user.id },
    );

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
