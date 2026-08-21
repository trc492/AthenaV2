import { fetchJSON } from "../fetcher";
import { loadApiKeys } from "@/lib/server/api-keys";
import type {
  EventStatus,
  PitAddresses,
  PitMap,
  Events,
  EventKey,
} from "./nexus-types";

const BASE = "https://frc.nexus/api/v1/";

async function getFromNexus<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  return fetchJSON<T>(url, {
    headers: { "Nexus-Api-Key": loadApiKeys().nexusApiKey },
  });
}

export async function getEventStatus(eventKey: EventKey): Promise<EventStatus> {
  return getFromNexus<EventStatus>(`event/${eventKey}`);
}

export async function getPitAddresses(
  eventKey: EventKey,
): Promise<PitAddresses> {
  return getFromNexus<PitAddresses>(`event/${eventKey}/pits`);
}

export async function getPitMap(eventKey: EventKey): Promise<PitMap> {
  return getFromNexus<PitMap>(`event/${eventKey}/map`);
}

export async function getEvents(): Promise<Events> {
  return getFromNexus<Events>("events");
}
