// Unsubmitted scouting form drafts, kept in localStorage so a reload, a
// back gesture or a remount does not throw away a scout's entry.

const DRAFT_PREFIX = "athena-draft";
const DRAFT_VERSION = 1;
/** Drafts older than this are treated as abandoned. */
export const DRAFT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

interface StoredDraft<T> {
  v: number;
  savedAt: number;
  data: T;
}

/** Build a draft key; returns null when any part is missing. */
export function draftKey(
  kind: "match" | "pit",
  parts: Array<string | number | null | undefined>,
): string | null {
  if (parts.some((part) => part === null || part === undefined || part === "")) {
    return null;
  }
  return [DRAFT_PREFIX, kind, ...parts].join(":");
}

export function loadDraft<T>(key: string, now = Date.now()): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredDraft<T>;
    if (
      stored?.v !== DRAFT_VERSION ||
      typeof stored.savedAt !== "number" ||
      now - stored.savedAt > DRAFT_MAX_AGE_MS ||
      stored.data === null ||
      typeof stored.data !== "object"
    ) {
      localStorage.removeItem(key);
      return null;
    }
    return stored.data;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T, now = Date.now()): void {
  try {
    const stored: StoredDraft<T> = { v: DRAFT_VERSION, savedAt: now, data };
    localStorage.setItem(key, JSON.stringify(stored));
  } catch {
    // Storage full or unavailable: the form still works, just without a draft.
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

/** Structural equality for plain JSON-like form data (key order ignored). */
export function sameFormValues(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameFormValues(value, b[index]))
    );
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!sameFormValues(left[key], right[key])) return false;
    }
    return true;
  }
  return false;
}
