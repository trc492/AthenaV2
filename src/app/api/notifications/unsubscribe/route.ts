import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";
import { loadSubscriptionsForUser } from "@/lib/notifications";

// POST /api/notifications/unsubscribe - Remove a push subscription for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint is required" },
        { status: 400 },
      );
    }

    const db = databaseManager.getService();

    // Load existing subscriptions via the shared notifications helper (no raw SQL needed)
    const subscriptions = await loadSubscriptionsForUser(session.user.id);

    // Remove the matching subscription
    const updated = subscriptions.filter((sub) => sub.endpoint !== endpoint);

    // Persist via the provider-agnostic updateUser method
    await db.updateUser(session.user.id, {
      pushSubscriptions: JSON.stringify(updated),
    });

    return NextResponse.json(
      { message: "Subscription removed successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error removing subscription:", error);
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 },
    );
  }
}
