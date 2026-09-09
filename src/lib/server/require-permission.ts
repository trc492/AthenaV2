/**
 * Auth guard helpers for API routes.
 *
 * Replaces the repeated 4-line session + permission check pattern with a
 * single awaited call. Returns a 401/403 NextResponse when access is denied,
 * or `null` when access is granted.
 *
 * Usage:
 *   import { requirePermission } from "@/lib/server/require-permission";
 *
 *   export async function GET(request: NextRequest) {
 *     const denied = await requirePermission(PERMISSIONS.VIEW_MATCH_SCOUTING);
 *     if (denied) return denied;
 *     // ... handler logic
 *   }
 *
 * For routes that need the session object after the check:
 *   const result = await requirePermissionWithSession(PERMISSIONS.VIEW_USERS);
 *   if (result.denied) return result.denied;
 *   const { session } = result;
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { hasPermission, hasAnyPermission } from "@/lib/auth/roles";
import type { Session } from "next-auth";

/** Checks a single permission. Returns a response on denial, null on success. */
export async function requirePermission(
  permission: string,
): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Checks that the session has at least one of the given permissions. */
export async function requireAnyPermission(
  permissions: string[],
): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAnyPermission(session.user.role, permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Like requirePermission but also returns the resolved session on success. */
export async function requirePermissionWithSession(permission: string): Promise<
  | { denied: NextResponse; session: null }
  | { denied: null; session: Session & { user: { role: string; id: string } } }
> {
  const session = await auth();
  if (!session?.user?.role) {
    return {
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }
  if (!hasPermission(session.user.role, permission)) {
    return {
      denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }
  return {
    denied: null,
    session: session as Session & { user: { role: string; id: string } },
  };
}

/** Checks that the user is authenticated (any valid session), no specific permission required. */
export async function requireAuth(): Promise<
  | { denied: NextResponse; session: null }
  | { denied: null; session: Session & { user: { id: string } } }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
    };
  }
  return {
    denied: null,
    session: session as Session & { user: { id: string } },
  };
}
