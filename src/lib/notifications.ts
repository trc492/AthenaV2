import webPush from "web-push";
import { databaseManager } from "@/db/database-manager";
import { APP_LOGO } from "@/lib/app-config";

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

export const MAX_SUBSCRIPTIONS_PER_USER = 10;

/**
 * Accepts only what a browser's PushManager produces. The server later POSTs
 * to this endpoint, so it must be a public HTTPS push service, not an address
 * on the server's own network.
 */
export function parseSubscription(value: unknown): StoredSubscription | null {
  const candidate = value as Partial<StoredSubscription> | null;
  const endpoint = candidate?.endpoint;
  const p256dh = candidate?.keys?.p256dh;
  const auth = candidate?.keys?.auth;
  if (typeof endpoint !== "string" || endpoint.length > 2048) return null;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!p256dh || !auth || p256dh.length > 512 || auth.length > 512) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const isIpLiteral = /^[\d.]+$/.test(host) || host.includes(":");
  if (
    url.protocol !== "https:" ||
    isIpLiteral ||
    !host.includes(".") ||
    host === "localhost" ||
    /\.(localhost|local|internal|lan|home|test)$/.test(host)
  ) {
    return null;
  }
  return { endpoint, keys: { p256dh, auth } };
}

/** The push service reports these when a subscription no longer exists. */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return status === 404 || status === 410;
}

/** Drop subscriptions the push service says are gone, so sends stop retrying them. */
async function pruneSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const gone = new Set(endpoints);
  try {
    const db = databaseManager.getService();
    if (!db.users) return;
    for (const user of await db.users.getSubscriptions()) {
      if (!user.push_subscriptions) continue;
      let stored: unknown;
      try {
        stored = JSON.parse(user.push_subscriptions);
      } catch {
        continue;
      }
      if (!Array.isArray(stored)) continue;
      const kept = stored.filter(
        (sub: StoredSubscription) => !gone.has(sub?.endpoint),
      );
      if (kept.length !== stored.length) {
        await db.updateUser(user.id, { pushSubscriptions: JSON.stringify(kept) });
      }
    }
  } catch (error) {
    // Cleanup is best effort; the notifications themselves were already sent.
    console.warn("Could not remove expired push subscriptions:", error);
  }
}

function ensureVapidConfigured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return false;
  }

  // VAPID_CONTACT_EMAIL should be set in your environment (e.g. mailto:team@example.com
  // or https://yourteam.example.com). Required by the Web Push spec for abuse contact.
  const contact =
    process.env.VAPID_CONTACT_EMAIL || "mailto:contact@example.com";

  // Safe to call multiple times (web-push just overwrites internal state)
  webPush.setVapidDetails(contact, publicKey, privateKey);
  return true;
}

export async function loadAllSubscriptions(): Promise<
  Map<string, StoredSubscription>
> {
  const db = databaseManager.getService();
  if (!db.users) {
    throw new Error(
      "User management is not supported by this database provider",
    );
  }
  const users = await db.users.getSubscriptions();

  const subscriptions = new Map<string, StoredSubscription>();

  for (const user of users) {
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
  if (!db.users) return [];

  const users = await db.users.getSubscriptions(userId);
  const raw = users[0]?.push_subscriptions;
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
    icon: payload.icon || APP_LOGO,
    badge: payload.badge || APP_LOGO,
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
      if (isGone(error)) await pruneSubscriptions([targetEndpoint]);
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

  const expired: string[] = [];
  const promises = Array.from(subscriptions.entries()).map(
    async ([endpoint, subscription]) => {
      try {
        await webPush.sendNotification(
          subscription as webPush.PushSubscription,
          JSON.stringify(notificationData),
        );
        return { endpoint, success: true } satisfies SendResult;
      } catch (error: unknown) {
        if (isGone(error)) expired.push(endpoint);
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
  await pruneSubscriptions(expired);

  return {
    results,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    skipped: false,
  };
}

/** Push subscriptions keyed by user ID, from a single database read. */
export async function loadSubscriptionsByUser(): Promise<
  Map<string, StoredSubscription[]>
> {
  const db = databaseManager.getService();
  const byUser = new Map<string, StoredSubscription[]>();
  if (!db.users) return byUser;
  for (const user of await db.users.getSubscriptions()) {
    if (!user.push_subscriptions) continue;
    try {
      const parsed = JSON.parse(user.push_subscriptions);
      if (Array.isArray(parsed) && parsed.length > 0) byUser.set(user.id, parsed);
    } catch {
      // Ignore one unreadable record rather than failing every recipient.
    }
  }
  return byUser;
}

export function isPushConfigured(): boolean {
  return ensureVapidConfigured();
}

export async function sendPushNotificationToSubscriptions(params: {
  subscriptions: StoredSubscription[];
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

  const subs = params.subscriptions;
  if (subs.length === 0) {
    return { results: [], successful: 0, failed: 0, skipped: false };
  }

  const notificationData = {
    title: params.payload.title,
    body: params.payload.body || "",
    icon: params.payload.icon || APP_LOGO,
    badge: params.payload.badge || APP_LOGO,
    data: {
      ...params.payload.data,
      url: params.payload.url || "/dashboard",
    },
  };

  const results: SendResult[] = [];
  const expiredSubscriptions: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          sub as webPush.PushSubscription,
          JSON.stringify(notificationData),
        );
        results.push({ endpoint: sub.endpoint, success: true });
      } catch (error: unknown) {
        if (isGone(error)) expiredSubscriptions.push(sub.endpoint);
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
  await pruneSubscriptions(expiredSubscriptions);

  return {
    results,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    skipped: false,
  };
}
