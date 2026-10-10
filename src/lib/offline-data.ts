import { HttpError } from "@/lib/fetcher";

export interface OfflineDataResult<T> {
  data: T | null;
  error: string | null;
  isOfflineData: boolean;
}

/** Guests require the server; authenticated users may fall back on transport failures. */
export async function loadWithOfflineCache<T>(options: {
  isGuest: boolean;
  load: () => Promise<T>;
  readCache: () => Promise<T | null>;
  offlineMessage: string;
  errorMessage: string;
}): Promise<OfflineDataResult<T>> {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  if (options.isGuest && !online) {
    return { data: null, error: "Guest access requires an internet connection", isOfflineData: false };
  }
  const cached = async (): Promise<OfflineDataResult<T> | null> => {
    if (options.isGuest) return null;
    try {
      const data = await options.readCache();
      return data === null ? null : { data, error: null, isOfflineData: true };
    } catch {
      return null;
    }
  };
  if (!online) return await cached() ?? {
    data: null, error: options.offlineMessage, isOfflineData: false,
  };
  try {
    return { data: await options.load(), error: null, isOfflineData: false };
  } catch (error) {
    // Permission and validation failures must not be hidden by cached data.
    if (!(error instanceof HttpError && error.status < 500)) {
      const result = await cached();
      if (result) return result;
    }
    return { data: null, error: options.errorMessage, isOfflineData: false };
  }
}
