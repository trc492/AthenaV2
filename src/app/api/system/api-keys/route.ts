import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";
import { getApiKeyStatus, saveApiKeys } from "@/lib/server/api-keys";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role: string = (session.user as any).role ?? "";
  if (!hasPermission(role, PERMISSIONS.MANAGE_SYSTEM_CONFIG)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** GET /api/system/api-keys
 * Returns which keys are configured and from which source.
 * Never returns raw secret values.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const status = getApiKeyStatus();
  return NextResponse.json({ status });
}

/** POST /api/system/api-keys
 * Body: { tbaApiKey?, ftcApiKey?, toaApiKey?, nexusApiKey?, pythonServiceUrl? }
 * Empty-string values clear the persisted key for that field.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = [
    "tbaApiKey",
    "ftcApiKey",
    "nexusApiKey",
  ];

  const patch: Record<string, string> = {};
  for (const key of allowed) {
    if (key in body && typeof body[key] === "string") {
      patch[key] = body[key];
    }
  }

  try {
    await saveApiKeys(patch);
    const status = getApiKeyStatus();
    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("[api-keys] Failed to save:", err);
    return NextResponse.json(
      { error: "Failed to save API keys" },
      { status: 500 },
    );
  }
}
