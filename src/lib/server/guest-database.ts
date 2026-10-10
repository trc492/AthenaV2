import type { Session } from "next-auth";
import type { DatabaseService, MatchEntry, PitEntry } from "@/lib/types";
import type { GuestEventGrant } from "./event-guest";

function publicFields(value: unknown, canViewNotes = false): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((child) => publicFields(child, canViewNotes));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !(canViewNotes ? /(scout|userid|username|email|preferredpartner)/i : /(note|comment|scout|userid|username|email|preferredpartner|drawing)/i).test(key),
      )
      .map(([key, child]) => [key, publicFields(child, canViewNotes)]),
  );
}

/** Request-local facade: never store this in the database singleton. */
export function guestDatabase(
  service: DatabaseService,
  session: Session | null,
): DatabaseService {
  if (!session?.guestEvent) {
    if (session?.user?.role === "guest") throw new Error("Missing guest scope");
    return service;
  }
  const grant: GuestEventGrant = session.guestEvent;
  if (grant.expiresAt <= Date.now()) throw new Error("Guest access expired");
  const inScope = (entry: {
    eventCode?: string;
    year: number;
    competitionType: string;
  }) =>
    entry.eventCode === grant.eventCode &&
    entry.year === grant.year &&
    entry.competitionType === grant.competitionType;
  const matches = async () =>
    (
      await service.getAllMatchEntries(
        grant.year,
        grant.eventCode,
        grant.competitionType,
      )
    )
      .filter(inScope)
      .map((entry) => ({ ...(publicFields(entry, grant.canViewNotes) as MatchEntry), ...(!grant.canViewNotes ? { notes: "" } : {}) }));
  const pits = async () =>
    (
      await service.getAllPitEntries(
        grant.year,
        grant.eventCode,
        grant.competitionType,
      )
    )
      .filter(inScope)
      .map((entry) => publicFields(entry, grant.canViewNotes) as PitEntry);
  const customEvents = async () =>
    (
      await service.getAllCustomEvents(grant.year, grant.competitionType)
    ).filter(inScope);
  const reads: Partial<DatabaseService> = {
    getAllMatchEntries: matches,
    getMatchEntries: async (teamNumber) =>
      (await matches()).filter((entry) => entry.teamNumber === teamNumber),
    getAllPitEntries: pits,
    getPitEntry: async (teamNumber) =>
      (await pits()).find((entry) => entry.teamNumber === teamNumber),
    getAllCustomEvents: customEvents,
    getCustomEvent: async (eventCode) =>
      eventCode === grant.eventCode ? (await customEvents())[0] : undefined,
  };
  return new Proxy(service, {
    get(_target, property) {
      if (Object.hasOwn(reads, property))
        return reads[property as keyof DatabaseService];
      throw new Error("Operation unavailable with guest access");
    },
  });
}
