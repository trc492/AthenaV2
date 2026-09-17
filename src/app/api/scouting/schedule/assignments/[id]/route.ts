import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

// Schedule assignments are now stored per-match in `matchAssignments` and are managed
// via range-based operations on `/api/scouting/schedule/assignments`.
// This legacy id-based endpoint remains to avoid 404s from stale clients.

export async function GET() {
  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use /api/scouting/schedule/assignments (range-based).",
    },
    { status: 410 },
  );
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use /api/scouting/schedule/assignments (range-based).",
    },
    { status: 410 },
  );
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "This endpoint is deprecated. Use /api/scouting/schedule/assignments (range-based).",
    },
    { status: 410 },
  );
}
