import type { UserRecord } from "@/lib/types";

/**
 * Per-instance cache for the account check that runs on every auth() call.
 * Changes made through this instance invalidate it immediately; other
 * instances pick them up within TTL_MS. Explicit session updates bypass it.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

export type SessionUser = Pick<
  UserRecord,
  "id" | "name" | "username" | "role" | "avatarUrl" | "deactivatedAt" | "sessionVersion"
>;

const cache = new Map<
  string,
  { expiresAt: number; user: Promise<SessionUser | undefined> }
>();

export function loadSessionUser(
  id: string,
  load: () => Promise<SessionUser | undefined>,
  fresh = false,
): Promise<SessionUser | undefined> {
  const now = Date.now();
  const hit = cache.get(id);
  if (!fresh && hit && hit.expiresAt > now) return hit.user;
  if (cache.size >= MAX_ENTRIES) cache.clear();
  // Keep only session fields; never hold password hashes in memory.
  const user = load().then((record) =>
    record && {
      id: record.id,
      name: record.name,
      username: record.username,
      role: record.role,
      avatarUrl: record.avatarUrl,
      deactivatedAt: record.deactivatedAt,
      sessionVersion: record.sessionVersion,
    },
  );
  cache.set(id, { expiresAt: now + TTL_MS, user });
  // A failed lookup must not be served from cache.
  user.catch(() => {
    if (cache.get(id)?.user === user) cache.delete(id);
  });
  return user;
}

/** Drops one account, or every account when no ID is given. */
export function invalidateSessionUser(id?: string) {
  if (id === undefined) cache.clear();
  else cache.delete(id);
}
