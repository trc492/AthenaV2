import { fetchJSON } from "../fetcher";
import { loadApiKeys } from "@/lib/server/api-keys";
import {
  TbaStatus,
  TbaEventSimple,
  TbaMatchSimple,
  TbaTeamSimple,
  TbaEvent,
  TbaOprs,
  TbaMatch,
  TbaEventRanking,
  TbaTeam,
  TbaMedia,
} from "./tba-types";

export type Team = { id: string; name: string };
export type TeamImage = { url: string };

const BASE = "https://thebluealliance.com/api/v3/";

async function getFromTba<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  return fetchJSON<T>(url, {
    headers: { "X-TBA-Auth-Key": loadApiKeys().tbaApiKey },
  });
}

/** 1. API Status **/
export function getStatus(): Promise<TbaStatus> {
  return getFromTba<TbaStatus>("status");
}

/** 2. Events for a Team **/
export function getTeamEvents(
  teamNumber: number,
  season: number,
): Promise<TbaEventSimple[]> {
  return getFromTba(`team/frc${teamNumber}/events/${season}/simple`);
}
export async function getTeamEventNames(
  teamNumber: number,
  season: number,
): Promise<Array<[string, string]>> {
  const events = await getTeamEvents(teamNumber, season);
  return events.map((e) => [e.name, e.key]);
}
export async function getTeamEventDateMap(
  teamNumber: number,
  season: number,
): Promise<Record<string, string>> {
  const events = await getTeamEvents(teamNumber, season);
  return Object.fromEntries(events.map((e) => [e.start_date, e.key]));
}

/** 3. Teams at an Event **/
export async function getEventTeams(eventKey: string): Promise<TbaTeam[]> {
  const teams = await getFromTba<TbaTeam[]>(`event/${eventKey}/teams`);
  return teams;
}

export async function getEventTeamNumbers(eventKey: string): Promise<number[]> {
  const teams = await getFromTba<TbaTeamSimple[]>(
    `event/${eventKey}/teams/simple`,
  );
  return teams.map((t) => t.team_number);
}

export async function getEventTeamsInfo(
  eventKey: string,
): Promise<Record<string, { nickname: string; team_number: number }>> {
  const teams = await getFromTba<TbaTeamSimple[]>(
    `event/${eventKey}/teams/simple`,
  );
  return Object.fromEntries(
    teams.map((t) => [
      t.key,
      { nickname: t.nickname, team_number: t.team_number },
    ]),
  );
}
export async function getEventTeamNumberMap(
  eventKey: string,
): Promise<Record<string, string>> {
  const teams = await getFromTba<TbaTeamSimple[]>(
    `event/${eventKey}/teams/simple`,
  );
  return Object.fromEntries(
    teams.map((t) => [String(t.team_number), t.nickname]),
  );
}

/** 4. Single Event Data **/
export function getEventDetails(eventCode: string): Promise<TbaEvent> {
  return getFromTba(`event/${eventCode}`);
}
export function getEventSummary(eventCode: string): Promise<TbaEventSimple> {
  return getFromTba(`event/${eventCode}/simple`);
}
export function getEventOprs(eventCode: string): Promise<TbaOprs> {
  return getFromTba(`event/${eventCode}/oprs`);
}
export async function getCurrentEventForTeam(
  teamNumber: number,
): Promise<TbaEventSimple | object> {
  const year = new Date().getFullYear();
  const events = await getFromTba<TbaEventSimple[]>(
    `team/frc${teamNumber}/events/${year}`,
  );
  const today = new Date().toISOString().slice(0, 10);
  return events.find((e) => e.start_date <= today && e.end_date >= today) ?? {};
}
export async function getEventDateRange(eventCode: string): Promise<string> {
  const e = await getEventSummary(eventCode);
  return `${e.start_date} ${e.end_date}`;
}

/** 5. Matches **/

export async function getTeamMatchesForEvent(
  teamNumber: number,
  eventCode: string,
): Promise<TbaMatchSimple[]> {
  const matches = await getFromTba<TbaMatchSimple[]>(
    `team/frc${teamNumber}/event/${eventCode}/matches/simple`,
  );
  return matches.sort((a, b) =>
    a.comp_level === "qm" && b.comp_level !== "qm"
      ? -1
      : b.comp_level === "qm" && a.comp_level !== "qm"
        ? 1
        : a.match_number - b.match_number,
  );
}
export function getEventMatches(eventCode: string): Promise<TbaMatch[]> {
  return getFromTba(`event/${eventCode}/matches`);
}
export async function getEventRankings(
  eventCode: string,
): Promise<TbaEventRanking[]> {
  const r = await getFromTba<TbaEventRanking[]>(`event/${eventCode}/rankings`);
  return r;
}
export function getMatchSummary(matchKey: string): Promise<TbaMatchSimple> {
  return getFromTba(`match/${matchKey}/simple`);
}
export function getMatchDetails(matchKey: string): Promise<TbaMatch> {
  return getFromTba(`match/${matchKey}`);
}

/** 6. Team Info & Media **/
export function getTeamInfo(teamNumber: number): Promise<TbaTeam> {
  return getFromTba(`team/frc${teamNumber}`);
}
export async function getTeamMedia(
  teamNumber: number,
  year: number,
): Promise<string[]> {
  const resp = await getFromTba<TbaMedia[]>(
    `team/frc${teamNumber}/media/${year}`,
  );
  const images: string[] = [];
  for (const item of resp) {
    if (item.type === "imgur" && item.preferred) {
      images.unshift(item.direct_url);
    } else if (item.type === "imgur") {
      images.push(item.direct_url);
    }
    if (images.length >= 3) break;
  }
  return images;
}
