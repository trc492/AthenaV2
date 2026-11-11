import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import bcrypt from "bcryptjs";
import { databaseManager } from "@/db/database-manager";
import { invalidateSessionUser } from "@/lib/server/session-user-cache";

// PUT /api/users/me/password - Change own password
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const { currentPassword, newPassword } = body ?? {};

    if (
      typeof currentPassword !== "string" || !currentPassword ||
      typeof newPassword !== "string" || !newPassword
    ) {
      return NextResponse.json(
        { error: "currentPassword and newPassword are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    const limit = checkRateLimit(request, {
      keyPrefix: `password:${session.user.id}`, windowMs: 60_000, maxRequests: 10,
    });
    if (limit.limited) return NextResponse.json(
      { error: "Too many password change attempts. Please try again later." },
      { status: 429, headers: getRateLimitHeaders(limit, 10) },
    );

    const service = databaseManager.getService();
    if (!service.users) {
      return NextResponse.json(
        { error: "Database operation not supported" },
        { status: 500 },
      );
    }

    // Get current password hash
    const user = await service.users.getById(session.user.id);
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await service.updateUser(session.user.id, { passwordHash: hashedPassword });
    invalidateSessionUser(session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating password:", error);
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 },
    );
  }
}
