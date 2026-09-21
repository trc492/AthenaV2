"use client";

import { useState, useEffect, useCallback } from "react";
import { APP_LOGO } from "@/lib/app-config";

export interface NotificationState {
  permission: NotificationPermission;
  isSupported: boolean;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  error: string | null;
}

interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
}

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    permission: "default",
    isSupported: false,
    isSubscribed: false,
    subscription: null,
    error: null,
  });

  const checkSubscriptionStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setState((prev) => ({
        ...prev,
        isSubscribed: !!subscription,
        subscription: subscription,
      }));
    } catch (error) {
      console.error("Error checking subscription status:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  // Check if notifications are supported and get current permission
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setState((prev) => ({ ...prev, isSupported: false }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isSupported: true,
      permission: Notification.permission,
    }));

    // Check if we already have a push subscription
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState((prev) => ({ ...prev, error: "Notifications not supported" }));
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission, error: null }));
      return permission === "granted";
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Permission request failed";
      setState((prev) => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [state.isSupported]);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState((prev) => ({ ...prev, error: "Push messaging not supported" }));
      return null;
    }

    if (state.permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) {
        return null;
      }
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID public key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        throw new Error("VAPID public key not configured");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        subscription,
        error: null,
      }));

      // Send subscription to your backend
      await sendSubscriptionToBackend(subscription);

      return subscription;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Subscription failed";
      setState((prev) => ({ ...prev, error: errorMessage }));
      return null;
    }
  }, [state.permission, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.subscription) {
      return true;
    }

    try {
      const unsubscribed = await state.subscription.unsubscribe();

      if (unsubscribed) {
        setState((prev) => ({
          ...prev,
          isSubscribed: false,
          subscription: null,
          error: null,
        }));

        // Remove subscription from your backend
        await removeSubscriptionFromBackend(state.subscription);
      }

      return unsubscribed;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unsubscribe failed";
      setState((prev) => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [state.subscription]);

  const showNotification = useCallback(
    async (options: NotificationOptions): Promise<boolean> => {
      if (state.permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) {
          return false;
        }
      }

      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(options.title, {
            body: options.body || "",
            icon: options.icon || APP_LOGO,
            badge: options.badge || APP_LOGO,
            data: options.data || {},
            requireInteraction: options.requireInteraction || false,
            silent: options.silent || false,
          });
        } else {
          new Notification(options.title, {
            body: options.body || "",
            icon: options.icon || APP_LOGO,
            data: options.data || {},
          });
        }
        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Notification failed";
        setState((prev) => ({ ...prev, error: errorMessage }));
        return false;
      }
    },
    [state.permission, requestPermission],
  );

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    checkSubscriptionStatus,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function sendSubscriptionToBackend(
  subscription: PushSubscription,
): Promise<void> {
  try {
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
    });
  } catch (error) {
    console.error("Failed to save subscription to backend:", error);
  }
}

async function removeSubscriptionFromBackend(
  subscription: PushSubscription,
): Promise<void> {
  try {
    await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (error) {
    console.error("Failed to remove subscription from backend:", error);
  }
}
