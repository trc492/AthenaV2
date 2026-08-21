import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// GET /api/users/me/avatar
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = databaseManager.getService();
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service not available" },
        { status: 500 },
      );
    }
    const result = await db.query<{
      avatarData: Buffer | null;
      avatarMimeType: string | null;
    }>(`
      SELECT avatarData, avatarMimeType
      FROM users
      WHERE id = @userId
    `, { userId: session.user.id });

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const avatarData = result.recordset[0]?.avatarData as Buffer | null;
    const avatarMimeType =
      (result.recordset[0]?.avatarMimeType as string | null) || "image/jpeg";

    if (!avatarData) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(avatarData), {
      status: 200,
      headers: {
        "Content-Type": avatarMimeType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Get avatar error:", error);
    return NextResponse.json(
      { error: "Failed to fetch avatar" },
      { status: 500 },
    );
  }
}

// POST /api/users/me/avatar
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { dataUrl } = body;
    if (
      !dataUrl ||
      typeof dataUrl !== "string" ||
      !dataUrl.startsWith("data:image")
    ) {
      return NextResponse.json(
        { error: "Invalid image data" },
        { status: 400 },
      );
    }

    // Decode base64 data URL
    const matches = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: "Unsupported image format" },
        { status: 400 },
      );
    }

    const mime = matches[1];
    const base64 = matches[3];
    const buffer = Buffer.from(base64, "base64");

    if (buffer.length > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: "Avatar must be 2MB or smaller" },
        { status: 400 },
      );
    }

    // Persist avatar bytes and metadata directly in DB
    const db = databaseManager.getService();
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service not available" },
        { status: 500 },
      );
    }
    const urlPath = "/api/users/me/avatar";

    await db.query(
      "UPDATE users SET avatarData = @avatarData, avatarMimeType = @avatarMimeType, avatarUrl = @avatarUrl, updated_at = GETDATE() WHERE id = @userId",
      {
        avatarData: buffer,
        avatarMimeType: mime,
        avatarUrl: urlPath,
        userId: session.user.id,
      },
    );

    return NextResponse.json({
      success: true,
      avatarUrl: `${urlPath}?v=${Date.now()}`,
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 },
    );
  }
}
