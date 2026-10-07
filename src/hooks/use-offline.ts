// React hook for detecting online/offline status and managing sync operations
// Automatically triggers sync when connectivity is restored

import { useState, useEffect, useCallback } from "react";
import { offlineQueueManager } from "@/lib/offline-queue-manager";
import type { SyncResult, NetworkStatus } from "@/lib/offline-types";
import { useSession } from "next-auth/react";

interface UseOfflineReturn {
  isOnline: boolean;
  networkStatus: NetworkStatus;
  pendingCount: number;
  totalQueuedCount: number;
  syncInProgress: boolean;
  lastSyncResult: SyncResult | null;
  // Actions
  triggerSync: () => Promise<SyncResult>;
  retryFailedEntries: () => Promise<SyncResult>;
  clearSyncedEntries: () => Promise<number>;
  // Config
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
}

export function useOffline(): UseOfflineReturn {
  const { data: session } = useSession();
  const isGuest = !!session?.guestEvent;
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true,
  );
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: typeof window !== "undefined" ? navigator.onLine : true,
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [totalQueuedCount, setTotalQueuedCount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Update queue counts
  const updateCounts = useCallback(async () => {
    if (isGuest) return;
    const counts = await readQueueCounts();
    if (counts) {
      setPendingCount(counts.pending);
      setTotalQueuedCount(counts.total);
    }
  }, [isGuest]);

  // Handle sync completion
  const handleSyncResult = useCallback(
    (result: SyncResult) => {
      setLastSyncResult(result);
      setSyncInProgress(false);
      updateCounts(); // Refresh counts after sync
    },
    [updateCounts],
  );

  // Trigger manual sync
  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (isGuest) throw new Error("Guest access is read-only");
    // Check navigator.onLine directly to avoid stale closure issues
    const currentlyOnline =
      typeof window !== "undefined" ? navigator.onLine : false;

    if (!currentlyOnline) {
      throw new Error("Cannot sync while offline");
    }

    if (syncInProgress) {
      throw new Error("Sync already in progress");
    }

    setSyncInProgress(true);

    try {
      const result = await offlineQueueManager.syncPendingEntries();
      handleSyncResult(result);
      return result;
    } catch (error) {
      setSyncInProgress(false);
      throw error;
    }
  }, [syncInProgress, handleSyncResult, isGuest]);

  // Retry failed entries
  const retryFailedEntries = useCallback(async (): Promise<SyncResult> => {
    if (isGuest) throw new Error("Guest access is read-only");
    // Check navigator.onLine directly to avoid stale closure issues
    const currentlyOnline =
      typeof window !== "undefined" ? navigator.onLine : false;

    if (!currentlyOnline) {
      throw new Error("Cannot retry while offline");
    }

    if (syncInProgress) {
      throw new Error("Sync already in progress");
    }

    setSyncInProgress(true);

    try {
      const result = await offlineQueueManager.retryFailedEntries();
      handleSyncResult(result);
      return result;
    } catch (error) {
      setSyncInProgress(false);
      throw error;
    }
  }, [syncInProgress, handleSyncResult, isGuest]);

  // Clear synced entries
  const clearSyncedEntries = useCallback(async (): Promise<number> => {
    if (isGuest) throw new Error("Guest access is read-only");
    const count = await offlineQueueManager.clearSyncedEntries();
    await updateCounts();
    return count;
  }, [updateCounts, isGuest]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      const now = new Date();
      setIsOnline(true);
      setNetworkStatus((prev) => ({
        ...prev,
        isOnline: true,
        lastOnline: now,
      }));

      // Auto-sync when coming back online if enabled
      if (autoSyncEnabled && pendingCount > 0) {
        setTimeout(() => {
          triggerSync().catch((error) => {
            console.error("Auto-sync failed after coming online:", error);
          });
        }, 1000); // Small delay to ensure connection is stable
      }
    };

    const handleOffline = () => {
      const now = new Date();
      setIsOnline(false);
      setNetworkStatus((prev) => ({
        ...prev,
        isOnline: false,
        lastOffline: now,
      }));
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [autoSyncEnabled, pendingCount, triggerSync]);

  // Set up sync listener
  useEffect(() => {
    const syncListener = (result: SyncResult) => {
      handleSyncResult(result);
    };

    offlineQueueManager.addSyncListener(syncListener);

    return () => {
      offlineQueueManager.removeSyncListener(syncListener);
    };
  }, [handleSyncResult]);

  // Update counts on mount and when online status changes
  // Poll the queue counts (the store has no change events)
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      readQueueCounts().then((counts) => {
        if (cancelled || !counts) return;
        setPendingCount(counts.pending);
        setTotalQueuedCount(counts.total);
      });
    };

    poll();
    const interval = setInterval(poll, 5000); // Update every 5 seconds

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Load auto-sync setting from queue manager
  useEffect(() => {
    const loadAutoSyncSetting = async () => {
      try {
        const config = await offlineQueueManager.getSyncConfig();
        setAutoSyncEnabled(config.autoSyncEnabled);
      } catch (error) {
        console.error("Failed to load auto-sync setting:", error);
      }
    };

    loadAutoSyncSetting();
  }, []);

  // Update auto-sync setting in queue manager when changed
  const updateAutoSyncEnabled = useCallback(async (enabled: boolean) => {
    try {
      await offlineQueueManager.setSyncConfig({ autoSyncEnabled: enabled });
      setAutoSyncEnabled(enabled);
    } catch (error) {
      console.error("Failed to update auto-sync setting:", error);
    }
  }, []);

  // Check if sync is in progress from queue manager
  useEffect(() => {
    const checkSyncStatus = () => {
      setSyncInProgress(offlineQueueManager.isSyncInProgress());
    };

    checkSyncStatus();

    // Check periodically
    const interval = setInterval(checkSyncStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    networkStatus,
    pendingCount,
    totalQueuedCount,
    syncInProgress,
    lastSyncResult,
    triggerSync,
    retryFailedEntries,
    clearSyncedEntries,
    autoSyncEnabled,
    setAutoSyncEnabled: updateAutoSyncEnabled,
  };
}

// Hook for just the online/offline status (lighter weight)
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  return isOnline;
}

async function readQueueCounts(): Promise<{
  pending: number;
  total: number;
} | null> {
  try {
    const [pending, total] = await Promise.all([
      offlineQueueManager.getPendingCount(),
      offlineQueueManager.getTotalQueuedCount(),
    ]);
    return { pending, total };
  } catch (error) {
    console.error("Failed to update queue counts:", error);
    return null;
  }
}
