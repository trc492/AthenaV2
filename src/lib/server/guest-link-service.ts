import type { DatabaseService, GuestLinkRecord } from "@/lib/types";
import {
  createGuestEventLink,
  verifyGuestEventLink,
  type GuestEventGrant,
} from "./event-guest";

async function database(service?: DatabaseService) {
  return service ?? (await import("./db-service")).getDbService();
}

export async function issueGuestLink(
  event: Pick<
    GuestEventGrant,
    "name" | "eventCode" | "year" | "competitionType" | "canAddScouting" | "canViewNotes"
  >,
  createdBy: string,
  service?: DatabaseService,
) {
  const { token, expiresAt } = createGuestEventLink(event);
  const grant = verifyGuestEventLink(token)!;
  const record: GuestLinkRecord = {
    ...event,
    id: grant.nonce,
    token,
    expiresAt,
    createdAt: Date.now(),
    createdBy,
    revokedAt: null,
  };
  await (await database(service)).addGuestLink(record);
  return record;
}

// One guest request checks its link in the proxy and both auth callbacks.
// Revocations through this instance apply at once, elsewhere within the TTL.
export const GUEST_LINK_TTL_MS = 5_000;
const guestLinkCache = new Map<
  string,
  { expiresAt: number; record: Promise<GuestLinkRecord | undefined> }
>();

function loadGuestLink(id: string, service?: DatabaseService) {
  const now = Date.now();
  const hit = guestLinkCache.get(id);
  if (hit && hit.expiresAt > now) return hit.record;
  if (guestLinkCache.size >= 500) guestLinkCache.clear();
  const record = database(service).then((db) => db.getGuestLink(id));
  guestLinkCache.set(id, { expiresAt: now + GUEST_LINK_TTL_MS, record });
  record.catch(() => {
    if (guestLinkCache.get(id)?.record === record) guestLinkCache.delete(id);
  });
  return record;
}

export function forgetGuestLink(id: string) {
  guestLinkCache.delete(id);
}

export async function resolveGuestEventLink(
  token: string,
  service?: DatabaseService,
): Promise<GuestEventGrant | null> {
  const grant = verifyGuestEventLink(token);
  if (!grant) return null;
  try {
    const record = await loadGuestLink(grant.nonce, service);
    return record && record.token === token && record.revokedAt === null
      ? { ...grant, canAddScouting: record.canAddScouting ?? false, canViewNotes: record.canViewNotes ?? false }
      : null;
  } catch {
    // No registry read means no authorization, including already signed-in guests.
    return null;
  }
}

export async function activeGuestLinks(service?: DatabaseService) {
  const records = await (await database(service)).getGuestLinks();
  return records
    .filter(
      (record) =>
        record.revokedAt === null &&
        record.expiresAt > Date.now() &&
        verifyGuestEventLink(record.token),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ token, ...record }) => ({
      ...record,
      path: `/guest/events/${token}`,
    }));
}
