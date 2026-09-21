import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkFirst, ExpirationPlugin } from "serwist";
import { APP_LOGO, APP_NAME } from "@/lib/app-config";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

/**
 * The TypeScript `webworker` lib is not enabled for this project (the app is
 * compiled against `dom`), so the service worker event and client shapes this
 * file uses are declared here.
 */
interface ExtendableServiceWorkerEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface BackgroundSyncEvent extends ExtendableServiceWorkerEvent {
  tag: string;
}

interface ServiceWorkerMessageEvent extends ExtendableServiceWorkerEvent {
  data?: { type?: string };
}

interface PushNotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface PushMessageEvent extends ExtendableServiceWorkerEvent {
  data: { json(): PushNotificationPayload } | null;
}

interface NotificationClickEvent extends ExtendableServiceWorkerEvent {
  notification: {
    close(): void;
    data?: { url?: string };
  };
}

interface ServiceWorkerClient {
  url: string;
  postMessage(message: unknown): void;
  focus?(): Promise<ServiceWorkerClient>;
}

interface ServiceWorkerClients {
  matchAll(options?: {
    type?: "window" | "worker" | "sharedworker" | "all";
    includeUncontrolled?: boolean;
  }): Promise<ServiceWorkerClient[]>;
  openWindow?(url: string): Promise<ServiceWorkerClient | null>;
}

/** Service worker lifecycle events this file listens for. */
interface ServiceWorkerEventMap {
  install: ExtendableServiceWorkerEvent;
  activate: ExtendableServiceWorkerEvent;
  sync: BackgroundSyncEvent;
  message: ServiceWorkerMessageEvent;
  push: PushMessageEvent;
  notificationclick: NotificationClickEvent;
  notificationclose: Event;
}

declare const self: WorkerGlobalScope &
  typeof globalThis & {
    registration: ServiceWorkerRegistration;
    clients: ServiceWorkerClients;
    addEventListener<K extends keyof ServiceWorkerEventMap>(
      type: K,
      listener: (event: ServiceWorkerEventMap[K]) => void | Promise<void>,
    ): void;
  };

// Offline fallback page HTML served when navigation fails offline
const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - ${APP_NAME}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #a1a1aa; margin-bottom: 1.5rem; }
    button { padding: 0.5rem 1.5rem; background: #22c55e; color: #fff; border: none; border-radius: 0.375rem; font-size: 1rem; cursor: pointer; }
    button:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're Offline</h1>
    <p>This page hasn't been cached yet. Connect to the internet and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`;

// The single cache name used by all app-page runtime caching.
// Both the SW handler and the OfflinePrecache component use this name so
// that programmatic writes from the page context are readable by the SW.
const APP_PAGES_CACHE = "app-pages";

// Custom runtime caching rules for scouting-specific routes, merged with defaults
const appRuntimeCaching = [
  // Auth session endpoint — cache so offline relaunches preserve the logged-in session.
  // Short timeout so the cached session is returned quickly when offline.
  {
    matcher: ({
      url: { pathname },
      sameOrigin,
    }: {
      url: URL;
      sameOrigin: boolean;
    }) => sameOrigin && pathname === "/api/auth/session",
    handler: new NetworkFirst({
      cacheName: "auth-session",
      networkTimeoutSeconds: 1,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 1,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days — matches JWT maxAge
        }),
      ],
    }),
  },
  // ── App pages (catch-all for every same-origin HTML page) ──────────
  // Covers /, /dashboard, /dashboard/*, /scout/*, /login, /signup, etc.
  // No request.mode / request.destination gate so that both real
  // navigations AND programmatic fetch() calls from OfflinePrecache
  // populate the same cache.
  {
    matcher: ({
      url: { pathname },
      sameOrigin,
    }: {
      url: URL;
      sameOrigin: boolean;
    }) =>
      sameOrigin &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/_next/") &&
      !pathname.startsWith("/serwist/"),
    handler: new NetworkFirst({
      cacheName: APP_PAGES_CACHE,
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    }),
  },
  // Event teams API — needed offline for scouting form dropdowns
  {
    matcher: ({
      url: { pathname },
      sameOrigin,
    }: {
      url: URL;
      sameOrigin: boolean;
    }) => sameOrigin && /^\/api\/events\/[^/]+\/teams/.test(pathname),
    handler: new NetworkFirst({
      cacheName: "event-teams-api",
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 24 * 60 * 60,
        }),
      ],
    }),
  },
  // Event schedule API — needed offline for team auto-assign
  {
    matcher: ({
      url: { pathname },
      sameOrigin,
    }: {
      url: URL;
      sameOrigin: boolean;
    }) => sameOrigin && /^\/api\/events\/[^/]+\/schedule/.test(pathname),
    handler: new NetworkFirst({
      cacheName: "event-schedule-api",
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 24 * 60 * 60,
        }),
      ],
    }),
  },
  {
    matcher: ({
      url: { pathname },
      sameOrigin,
    }: {
      url: URL;
      sameOrigin: boolean;
    }) =>
      sameOrigin && pathname === "/api/scouting/entries/match-assignments",
    handler: new NetworkFirst({
      cacheName: "scout-schedule-api",
      networkTimeoutSeconds: 3,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 24 * 60 * 60,
        }),
      ],
    }),
  },
  // Spread the default cache rules after our custom ones so ours take priority
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false, // Disabled — navigation preload bypasses cache and breaks offline
  runtimeCaching: appRuntimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// Cache the offline fallback on install so it's always available
self.addEventListener("install", (event: ExtendableServiceWorkerEvent) => {
  event.waitUntil(
    caches.open("offline-fallback").then((cache) =>
      cache.put(
        new Request("/~offline"),
        new Response(OFFLINE_FALLBACK_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
      ),
    ),
  );
});

serwist.addEventListeners();

// Background sync tags
const SYNC_TAGS = {
  OFFLINE_DATA: "offline-data-sync",
  RETRY_FAILED: "retry-failed-sync",
} as const;

// Handle background sync events
self.addEventListener("sync", function (event: BackgroundSyncEvent) {
  console.log("[Service Worker] Background sync event:", event.tag);

  if (event.tag === SYNC_TAGS.OFFLINE_DATA) {
    event.waitUntil(syncOfflineData());
  } else if (event.tag === SYNC_TAGS.RETRY_FAILED) {
    event.waitUntil(retryFailedEntries());
  }
});

// Sync offline data
async function syncOfflineData() {
  console.log("[Service Worker] Syncing offline data...");

  try {
    // Import the queue manager in the service worker context
    const { offlineQueueManager } =
      await import("../lib/offline-queue-manager");
    const result = await offlineQueueManager.syncPendingEntries();

    console.log("[Service Worker] Sync completed:", result);

    // Notify all clients about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_COMPLETED",
        result,
      });
    });

    // Show notification if there were sync errors
    if (!result.success && result.errors.length > 0) {
      await self.registration.showNotification("Sync Issues", {
        body: `${result.failedCount} entries failed to sync. Check the app for details.`,
        icon: APP_LOGO,
        badge: APP_LOGO,
        tag: "sync-error",
        requireInteraction: true,
        data: { url: "/dashboard" },
      });
    } else if (result.syncedCount > 0) {
      await self.registration.showNotification("Data Synced", {
        body: `${result.syncedCount} scouting entries synced successfully.`,
        icon: APP_LOGO,
        badge: APP_LOGO,
        tag: "sync-success",
        requireInteraction: false,
        data: { url: "/dashboard" },
      });
    }
  } catch (error) {
    console.error("[Service Worker] Sync failed:", error);

    // Show error notification
    await self.registration.showNotification("Sync Failed", {
      body: "Failed to sync offline data. Please try again manually.",
      icon: APP_LOGO,
      badge: APP_LOGO,
      tag: "sync-error",
      requireInteraction: true,
      data: { url: "/dashboard" },
    });
  }
}

// Retry failed entries
async function retryFailedEntries() {
  console.log("[Service Worker] Retrying failed entries...");

  try {
    const { offlineQueueManager } =
      await import("../lib/offline-queue-manager");
    const result = await offlineQueueManager.retryFailedEntries();

    console.log("[Service Worker] Retry completed:", result);

    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "RETRY_COMPLETED",
        result,
      });
    });
  } catch (error) {
    console.error("[Service Worker] Retry failed:", error);
  }
}

// Handle messages from the main app
self.addEventListener("message", async function (event: ServiceWorkerMessageEvent) {
  console.log("[Service Worker] Received message:", event.data);

  if (event.data?.type === "REGISTER_SYNC") {
    // Register background sync
    try {
      await self.registration.sync.register(SYNC_TAGS.OFFLINE_DATA);
      console.log("[Service Worker] Background sync registered");
    } catch (error) {
      console.error(
        "[Service Worker] Failed to register background sync:",
        error,
      );
    }
  } else if (event.data?.type === "REGISTER_RETRY_SYNC") {
    // Register retry sync
    try {
      await self.registration.sync.register(SYNC_TAGS.RETRY_FAILED);
      console.log("[Service Worker] Retry sync registered");
    } catch (error) {
      console.error("[Service Worker] Failed to register retry sync:", error);
    }
  }
});

// Add notification event listeners
self.addEventListener("push", function (event: PushMessageEvent) {
  console.log("[Service Worker] Push Received.");

  if (!event.data) {
    return;
  }

  const data = event.data.json();
  const title = data.title || APP_NAME;
  const options = {
    body: data.body || "New notification",
    icon: APP_LOGO,
    badge: APP_LOGO,
    data: data.data || {},
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event: NotificationClickEvent) {
  console.log("[Service Worker] Notification click Received.");

  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(function (clientList) {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && client.focus) {
            return client.focus();
          }
        }

        // If no existing window/tab, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});

self.addEventListener("notificationclose", function (event: Event) {
  console.log("[Service Worker] Notification closed.", event);
});
