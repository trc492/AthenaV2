import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import {
  loadSystemSettings,
  saveSystemSettings,
} from "@/lib/server/env-file";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role: string = session.user.role ?? "";
  if (!hasPermission(role, PERMISSIONS.MANAGE_SYSTEM_CONFIG)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** GET /api/system/settings
 * Returns the current system settings.
 * Requires MANAGE_SYSTEM_CONFIG permission (admin only).
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const settings = loadSystemSettings();
  return NextResponse.json({ settings });
}

/** PATCH /api/system/settings
 * Accepts a partial SystemSettings body to update one or more settings.
 * Requires MANAGE_SYSTEM_CONFIG permission (admin only).
 */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: { signupEnabled?: boolean } = {};
  if ("signupEnabled" in body) {
    if (typeof body.signupEnabled !== "boolean") {
      return NextResponse.json(
        { error: "signupEnabled must be a boolean" },
        { status: 400 },
      );
    }
    patch.signupEnabled = body.signupEnabled;
  }

  try {
    const updated = await saveSystemSettings(patch);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error("[system/settings] Failed to save:", err);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 },
    );
  }
}
