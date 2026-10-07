import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";
import { USERNAME_REGEX } from "@/lib/server/user-service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = databaseManager.getService();
    if (!db.users) {
      return NextResponse.json(
        { error: "User management is not supported by this database provider" },
        { status: 500 },
      );
    }
    const user = await db.users.getById(session.user.id);
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-20 characters and contain only letters, numbers, underscores, or dashes",
        },
        { status: 400 },
      );
    }

    const db = databaseManager.getService();
    if (!db.users) {
      return NextResponse.json(
        { error: "User management is not supported by this database provider" },
        { status: 500 },
      );
    }
    // Check if username is already taken by another user
    const existingUser = await db.users.getByUsername(username.trim());

    if (existingUser && existingUser.id !== session.user.id) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 },
      );
    }

    // Update the user
    await db.updateUser(session.user.id, {
      name: name.trim(),
      username: username.trim(),
    });

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
