import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { databaseManager } from "@/db/database-manager";

interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription: StoredSubscription = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 },
      );
    }

    const db = databaseManager.getService();
    if (!db.query) {
      return NextResponse.json(
        { error: "Database service does not support direct SQL queries" },
        { status: 500 },
      );
    }
    // Get current subscriptions for the user
    const userResult = await db.query<{
      push_subscriptions: string | null;
    }>("SELECT push_subscriptions FROM users WHERE id = @userId", {
      userId: session.user.id,
    });

    let subscriptions: StoredSubscription[] = [];
    if (
      userResult.recordset.length > 0 &&
      userResult.recordset[0].push_subscriptions
    ) {
      try {
        subscriptions = JSON.parse(userResult.recordset[0].push_subscriptions);
      } catch (error) {
        console.error("Error parsing existing subscriptions:", error);
        subscriptions = [];
      }
    }

    // Check if subscription already exists
    const existingIndex = subscriptions.findIndex(
      (sub) => sub.endpoint === subscription.endpoint,
    );
    if (existingIndex >= 0) {
      // Update existing subscription
      subscriptions[existingIndex] = subscription;
    } else {
      // Add new subscription
      subscriptions.push(subscription);
    }

    // Save back to database
    await db.query(
      "UPDATE users SET push_subscriptions = @subscriptions WHERE id = @userId",
      {
        userId: session.user.id,
        subscriptions: JSON.stringify(subscriptions),
      },
    );

    console.log(
      "Push subscription saved for user:",
      session.user.id,
      subscription.endpoint,
    );

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
