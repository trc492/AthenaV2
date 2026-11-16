import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";
import {
  loadSubscriptionsForUser,
  MAX_SUBSCRIPTIONS_PER_USER,
  parseSubscription,
} from "@/lib/notifications";

// POST /api/notifications/subscribe - Register a push subscription for the current user
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = parseSubscription(
      await request.json().catch(() => null),
    );

    if (!subscription) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 },
      );
    }

    const db = databaseManager.getService();

    // Load existing subscriptions via the shared notifications helper (no raw SQL needed)
    const subscriptions = await loadSubscriptionsForUser(session.user.id);

    // Update existing or add new subscription
    const existingIndex = subscriptions.findIndex(
      (sub) => sub.endpoint === subscription.endpoint,
    );
    if (existingIndex >= 0) {
      subscriptions[existingIndex] = subscription;
    } else {
      subscriptions.push(subscription);
      // Keep the most recent devices; old browsers re-subscribe when opened.
      subscriptions.splice(
        0,
        Math.max(0, subscriptions.length - MAX_SUBSCRIPTIONS_PER_USER),
      );
    }

    // Persist via the provider-agnostic updateUser method
    await db.updateUser(session.user.id, {
      pushSubscriptions: JSON.stringify(subscriptions),
    });

    return NextResponse.json(
      { message: "Subscription saved successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error saving subscription:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 },
    );
  }
}
