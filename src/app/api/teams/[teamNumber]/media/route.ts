import { PERMISSIONS } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/server/require-permission";
import { NextRequest, NextResponse } from "next/server";
import { getTeamMedia } from "@/lib/api/tba";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamNumber: string }> },
) {
  const denied = await requirePermission(PERMISSIONS.VIEW_DASHBOARD);
  if (denied) return denied;
  try {
    const { teamNumber } = await params;
    const { searchParams } = new URL(request.url);
    const competitionType = searchParams.get("competitionType") || "FRC";
    const seasonParam = searchParams.get("season");
    const season = seasonParam
      ? parseInt(seasonParam)
      : new Date().getFullYear();

    if (!teamNumber) {
      return NextResponse.json(
        { error: "Team number is required" },
        { status: 400 },
      );
    }

    const teamNum = parseInt(teamNumber);
    if (isNaN(teamNum)) {
      return NextResponse.json(
        { error: "Invalid team number" },
        { status: 400 },
      );
    }

    if (competitionType === "FTC") {
      // FTC doesn't have media API in the same way, return empty array
      return NextResponse.json([]);
    } else {
      // FRC via TBA
      const images = await getTeamMedia(teamNum, season);

      return NextResponse.json(images);
    }
  } catch (error) {
    console.error("Error fetching team media:", error);
    return NextResponse.json(
      { error: "Failed to fetch team media" },
      { status: 500 },
    );
  }
}
