"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

interface SettledResult<T> {
  key: string;
  version: number;
  data: T | undefined;
  error: unknown;
}

export interface AsyncDataState<T> {
  /** Latest data for `key`. Kept while a same-key `reload()` is in flight. */
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Re-run `load` for the current key. */
  reload: () => void;
}

/**
 * Loads async data for `key`, re-running `load` whenever the key changes.
 *
 * Loading state is derived from whether the settled result matches the
 * current request, so the effect never sets state synchronously, and a slow
 * response for a stale key can never overwrite a newer one. Pass `null` as
 * the key to skip loading.
 */
export function useAsyncData<T>(
  key: string | null,
  load: () => Promise<T>,
): AsyncDataState<T> {
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState<SettledResult<T> | null>(null);
  const runLoad = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;

    let cancelled = false;
    runLoad().then(
      (data) => {
        if (!cancelled) setSettled({ key, version, data, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setSettled({ key, version, data: undefined, error });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const sameKey = key !== null && settled?.key === key;
  const isCurrent = sameKey && settled.version === version;

  return {
    data: sameKey ? settled.data : undefined,
    error: isCurrent ? settled.error : null,
    loading: key !== null && !isCurrent,
    reload,
  };
}
