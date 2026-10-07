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
    "name" | "eventCode" | "year" | "competitionType"
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

export async function resolveGuestEventLink(
  token: string,
  service?: DatabaseService,
): Promise<GuestEventGrant | null> {
  const grant = verifyGuestEventLink(token);
  if (!grant) return null;
  try {
    const db = await database(service);
    const record = await db.getGuestLink(grant.nonce);
    return record && record.token === token && record.revokedAt === null
      ? grant
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
