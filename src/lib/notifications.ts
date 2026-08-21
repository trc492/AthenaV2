import webPush from "web-push";
import { databaseManager } from "@/db/database-manager";

export interface StoredSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  url?: string;
}

export type SendResult = {
  endpoint: string;
  success: boolean;
  error?: string;
};

function ensureVapidConfigured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return false;
  }

  // Safe to call multiple times (web-push just overwrites internal state)
  webPush.setVapidDetails(
    "mailto:noahnfang@outlook.com",
    publicKey,
    privateKey,
  );
  return true;
}

export async function loadAllSubscriptions(): Promise<
  Map<string, StoredSubscription>
> {
  const db = databaseManager.getService();
  if (!db.query) {
    throw new Error("Database service does not support direct SQL queries");
  }
  const result = await db.query<{
    id: string;
    push_subscriptions: string | null;
  }>(
    "SELECT id, push_subscriptions FROM users WHERE push_subscriptions IS NOT NULL",
  );

  const subscriptions = new Map<string, StoredSubscription>();

  for (const user of result.recordset) {
    if (user.push_subscriptions) {
      try {
        const userSubscriptions: StoredSubscription[] = JSON.parse(
          user.push_subscriptions,
        );
        for (const sub of userSubscriptions) {
          subscriptions.set(sub.endpoint, sub);
        }
      } catch (error) {
        console.error(
          `Error parsing subscriptions for user ${user.id}:`,
          error,
        );
      }
    }
  }

  return subscriptions;
}

export async function loadSubscriptionsForUser(
  userId: string,
): Promise<StoredSubscription[]> {
  const db = databaseManager.getService();
  if (!db.query) return [];

  const result = await db.query<{
    push_subscriptions: string | null;
  }>("SELECT push_subscriptions FROM users WHERE id = @userId", {
    userId,
  });

  const raw = result.recordset?.[0]?.push_subscriptions;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSubscription[]) : [];
  } catch {
    return [];
  }
}

export async function sendPushNotification(params: {
  payload: NotificationPayload;
  targetEndpoint?: string;
}): Promise<{
  results: SendResult[];
  successful: number;
  failed: number;
  skipped: boolean;
}> {
  const vapidOk = ensureVapidConfigured();
  if (!vapidOk) {
    return { results: [], successful: 0, failed: 0, skipped: true };
  }

  const { payload, targetEndpoint } = params;

  const notificationData = {
    title: payload.title,
    body: payload.body || "",
    icon: payload.icon || "/TRCLogo.webp",
    badge: payload.badge || "/TRCLogo.webp",
    data: {
      ...payload.data,
      url: payload.url || "/dashboard",
    },
  };

  const subscriptions = await loadAllSubscriptions();
  const results: SendResult[] = [];

  if (targetEndpoint) {
    const subscription = subscriptions.get(targetEndpoint);
    if (!subscription) {
      return {
        results: [
          {
            endpoint: targetEndpoint,
            success: false,
            error: "Subscription not found",
          },
        ],
        successful: 0,
        failed: 1,
        skipped: false,
      };
    }

    try {
      await webPush.sendNotification(
        subscription as webPush.PushSubscription,
        JSON.stringify(notificationData),
      );
      results.push({ endpoint: targetEndpoint, success: true });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      results.push({
        endpoint: targetEndpoint,
        success: false,
        error: errorMessage,
      });
    }

    return {
      results,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      skipped: false,
    };
  }

  const promises = Array.from(subscriptions.entries()).map(
    async ([endpoint, subscription]) => {
      try {
        await webPush.sendNotification(
          subscription as webPush.PushSubscription,
          JSON.stringify(notificationData),
        );
        return { endpoint, success: true } satisfies SendResult;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          endpoint,
          success: false,
          error: errorMessage,
        } satisfies SendResult;
      }
    },
  );

  results.push(...(await Promise.all(promises)));

  return {
    results,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    skipped: false,
  };
}

export async function sendPushNotificationToUser(params: {
  userId: string;
  payload: NotificationPayload;
}): Promise<{
  results: SendResult[];
  successful: number;
  failed: number;
  skipped: boolean;
}> {
  const vapidOk = ensureVapidConfigured();
  if (!vapidOk) {
    return { results: [], successful: 0, failed: 0, skipped: true };
  }

  const subs = await loadSubscriptionsForUser(params.userId);
  if (subs.length === 0) {
    return { results: [], successful: 0, failed: 0, skipped: false };
  }

  const notificationData = {
    title: params.payload.title,
    body: params.payload.body || "",
    icon: params.payload.icon || "/TRCLogo.webp",
    badge: params.payload.badge || "/TRCLogo.webp",
    data: {
      ...params.payload.data,
      url: params.payload.url || "/dashboard",
    },
  };

  const results: SendResult[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          sub as webPush.PushSubscription,
          JSON.stringify(notificationData),
        );
        results.push({ endpoint: sub.endpoint, success: true });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          endpoint: sub.endpoint,
          success: false,
          error: errorMessage,
        });
      }
    }),
  );

  return {
    results,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    skipped: false,
  };
}
