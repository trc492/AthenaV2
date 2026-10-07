import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/auth/roles";
import {
  requirePermission,
  requirePermissionWithSession,
} from "@/lib/server/require-permission";
import { guestEventSchema } from "@/lib/server/event-guest";
import {
  activeGuestLinks,
  issueGuestLink,
} from "@/lib/server/guest-link-service";
import { getDbService } from "@/lib/server/db-service";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const denied = await requirePermission(PERMISSIONS.MANAGE_EVENT_SETTINGS);
  if (denied) return denied;
  try {
    return NextResponse.json({ links: await activeGuestLinks() }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Unable to load guest links" },
      { status: 503, headers },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requirePermission(PERMISSIONS.MANAGE_EVENT_SETTINGS);
  if (denied) return denied;
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f0-9]{32}$/.test(id))
    return NextResponse.json(
      { error: "Invalid link ID" },
      { status: 400, headers },
    );
  try {
    const service = getDbService();
    if (!(await service.getGuestLink(id)))
      return NextResponse.json(
        { error: "Guest link not found" },
        { status: 404, headers },
      );
    await service.revokeGuestLink(id, Date.now());
    return NextResponse.json({ success: true }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Unable to revoke guest link" },
      { status: 503, headers },
    );
  }
}

export async function POST(request: NextRequest) {
  const { denied, session } = await requirePermissionWithSession(
    PERMISSIONS.MANAGE_EVENT_SETTINGS,
  );
  if (denied) return denied;
  const parsed = guestEventSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  try {
    const { token, expiresAt } = await issueGuestLink(
      parsed.data,
      session.user.id,
    );
    return NextResponse.json(
      { path: `/guest/events/${token}`, expiresAt },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to save guest link. Check the database and server authentication secret.",
      },
      { status: 503, headers },
    );
  }
}
