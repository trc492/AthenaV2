"use client";

import { useEffect, useEffectEvent } from "react";
import { startActivePolling } from "@/lib/active-polling";

export function useActivePolling(
  refresh: () => void,
  intervalMs: number,
  enabled = true,
) {
  const onRefresh = useEffectEvent(refresh);
  useEffect(() => {
    if (!enabled) return;
    return startActivePolling(() => onRefresh(), intervalMs);
  }, [intervalMs, enabled]);
}
