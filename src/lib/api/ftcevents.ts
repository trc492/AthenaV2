import { fetchJSON } from "../fetcher";
import { loadApiKeys } from "@/lib/server/api-keys";
import {
  FtcApiStatus,
  FtcEvent,
  FtcTeam,
  FtcEventList,
  FtcTeamList,
  FtcMatchResults,
  FtcEventRankings,
  FtcAwardsList,
  FtcAwardListings,
  FtcScoreDetailsList,
  FtcMatchSchedule,
  FtcLeagueList,
  FtcLeagueMembers,
  FtcSeasonSummary,
  FtcAdvancement,
  FtcAdvancementSource,
  FtcAllianceSelection,
  FtcAllianceSelectionDetail,
} from "./ftcevents-types";

export type Team = { id: string; name: string };

const BASE = "https://ftc-api.firstinspires.org/v2.0/";
async function getFromFtc<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  return fetchJSON<T>(url, {
    headers: {
      Authorization: `Basic ${loadApiKeys().ftcApiKey}`,
      "Content-Type": "application/json",
    },
  });
}

/** 1. API Status **/
export function getApiStatus(): Promise<FtcApiStatus> {
  return getFromFtc<FtcApiStatus>("");
}

/** 2. Season Data **/
export function getSeasonSummary(season: number): Promise<FtcSeasonSummary> {
  return getFromFtc<FtcSeasonSummary>(`${season - 1}`);
}

export function getSeasonEvents(
  season: number,
  eventCode?: string,
  teamNumber?: number,
): Promise<FtcEventList> {
  let path = `${season - 1}/events`;
  const params = new URLSearchParams();

  if (eventCode) params.append("eventCode", eventCode);
  if (teamNumber) params.append("teamNumber", teamNumber.toString());

  const queryString = params.toString();
  if (queryString) path += `?${queryString}`;

  return getFromFtc<FtcEventList>(path);
}

export function getSeasonTeams(
  season: number,
  teamNumber?: number,
  eventCode?: string,
  state?: string,
  page?: number,
): Promise<FtcTeamList> {
  let path = `${season - 1}/teams`;
  const params = new URLSearchParams();

  if (teamNumber) params.append("teamNumber", teamNumber.toString());
  if (eventCode) params.append("eventCode", eventCode);
  if (state) params.append("state", state);
  if (page) params.append("page", page.toString());

  const queryString = params.toString();
  if (queryString) path += `?${queryString}`;

  return getFromFtc<FtcTeamList>(path);
}

export function getSeasonLeagues(
  season: number,
  regionCode?: string,
  leagueCode?: string,
): Promise<FtcLeagueList> {
  let path = `${season - 1}/leagues`;
  const params = new URLSearchParams();

  if (regionCode) params.append("regionCode", regionCode);
  if (leagueCode) params.append("leagueCode", leagueCode);

  const queryString = params.toString();
  if (queryString) path += `?${queryString}`;

  return getFromFtc<FtcLeagueList>(path);
}

export function getLeagueMembers(
  season: number,
  regionCode: string,
  leagueCode: string,
): Promise<FtcLeagueMembers> {
  return getFromFtc<FtcLeagueMembers>(
    `${season - 1}/leagues/members/${regionCode}/${leagueCode}`,
  );
}

export function getLeagueRankings(
  season: number,
  regionCode: string,
  leagueCode: string,
): Promise<FtcEventRankings> {
  return getFromFtc<FtcEventRankings>(
    `${season - 1}/leagues/rankings/${regionCode}/${leagueCode}`,
  );
}

/** 3. Event Data **/
export function getEventDetails(
  season: number,
  eventCode: string,
): Promise<FtcEvent> {
  return getFromFtc<FtcEvent>(`${season - 1}/events?eventCode=${eventCode}`);
}

export function getEventRankings(
  season: number,
  eventCode: string,
  teamNumber?: number,
  top?: number,
): Promise<FtcEventRankings> {
  let path = `${season - 1}/rankings/${eventCode}`;
  const params = new URLSearchParams();

  if (teamNumber) params.append("teamNumber", teamNumber.toString());
  if (top) params.append("top", top.toString());

  const queryString = params.toString();
  if (queryString) path += `?${queryString}`;

  return getFromFtc<FtcEventRankings>(path);
}

export function getEventAlliances(
  season: number,
  eventCode: string,
): Promise<FtcAllianceSelection> {
  return getFromFtc<FtcAllianceSelection>(
    `${season - 1}/alliances/${eventCode}`,
  );
}

export function getEventAllianceDetails(
  season: number,
  eventCode: string,
): Promise<FtcAllianceSelectionDetail> {
  return getFromFtc<FtcAllianceSelectionDetail>(
    `${season - 1}/alliances/${eventCode}/selection`,
  );
}

export function getEventAdvancement(
  season: number,
  eventCode: string,
  excludeSkipped?: boolean,
): Promise<FtcAdvancement> {
  let path = `${season - 1}/advancement/${eventCode}`;
  if (excludeSkipped) path += "?excludeSkipped=true";
  return getFromFtc<FtcAdvancement>(path);
}

export function getEventAdvancementSource(
  season: number,
  eventCode: string,
  includeDeclines?: boolean,
): Promise<FtcAdvancementSource[]> {
  let path = `${season - 1}/advancement/${eventCode}/source`;
  if (includeDeclines) path += "?includeDeclines=true";
  return getFromFtc<FtcAdvancementSource[]>(path);
}

/** 4. Match Data **/
export function getEventMatches(
  season: number,
  eventCode: string,
  tournamentLevel?: string,
  teamNumber?: number,
  matchNumber?: number,
  start?: number,
  end?: number,
): Promise<FtcMatchResults> {
  let path = `${season - 1}/matches/${eventCode}`;
  const params = new URLSearchParams();

  if (tournamentLevel) params.append("tournamentLevel", tournamentLevel);
  if (teamNumber) params.append("teamNumber", teamNumber.toString());
  if (matchNumber) params.append("matchNumber", matchNumber.toString());
  if (start !== undefined) params.append("start", start.toString());
  if (end !== undefined) params.append("end", end.toString());

  const queryString = params.toString();
  if (queryString) path += `?${queryString}`;

  return getFromFtc<FtcMatchResults>(path);
}

export function getEventSchedule(
  season: number,
  eventCode: string,
  tournamentLevel?: string,
  teamNumber?: number,
  start?: number,
  end?: number,
): Promise<FtcMatchSchedule> {
  let path = `${season - 1}/schedule/${eventCode}`;
  const params = new URLSearchParams();

  if (tournamentLevel) params.append("tournamentLevel", tournamentLevel);
  if (teamNumber) params.append("teamNumber", teamNumber.toString());
  if (start !== undefined) params.append("start", start.toString());
  if (end !== undefined) params.append("end", end.toString());

  const queryString = params.toString();
  if (queryString) path += `?${queryString}`;

  return getFromFtc<FtcMatchSchedule>(path);
}

export function getEventScores(
  season: number,
  eventCode: string,
  tournamentLevel: string,
  teamNumber?: number,
  matchNumber?: number,
  start?: number,
  end?: number,
): Promise<FtcScoreDetailsList> {
  let path = `${season - 1}/scores/${eventCode}/${tournamentLevel}`;
  const params = new URLSearchParams();

  if (teamNumber) params.append("teamNumber", teamNumber.toString());
  if (matchNumber) params.append("matchNumber", matchNumber.toString());
  if (start !== undefined) params.append("start", start.toString());
  if (end !== undefined) params.append("end", end.toString());

  const queryString = params.toString();
  if (queryString) path += `?${queryString}`;

  return getFromFtc<FtcScoreDetailsList>(path);
}

/** 5. Awards **/
export function getSeasonAwardListings(
  season: number,
): Promise<FtcAwardListings> {
  return getFromFtc<FtcAwardListings>(`${season - 1}/awards/list`);
}

export function getEventAwards(
  season: number,
  eventCode?: string,
  teamNumber?: number,
): Promise<FtcAwardsList> {
  let path = `${season - 1}/awards/${eventCode || teamNumber}`;
  if (eventCode && teamNumber) {
    path = `${season - 1}/awards/${eventCode}/${teamNumber}`;
  }
  return getFromFtc<FtcAwardsList>(path);
}

/** 6. Team Data **/
export function getTeamInfo(
  season: number,
  teamNumber: number,
): Promise<FtcTeam> {
  return getFromFtc<FtcTeam>(`${season - 1}/teams?teamNumber=${teamNumber}`);
}

/** Helper Functions **/
export async function getTeamEventNames(
  teamNumber: number,
  season: number,
): Promise<Array<[string, string]>> {
  const eventList = await getSeasonEvents(season, undefined, teamNumber);
  return (eventList.events || []).map((e) => [e.name || "", e.code || ""]);
}

export async function getEventTeamNumbers(
  season: number,
  eventCode: string,
): Promise<number[]> {
  const teamList = await getSeasonTeams(season, undefined, eventCode);
  return (teamList.teams || []).map((t) => t.teamNumber);
}

export async function getCurrentEventForTeam(
  teamNumber: number,
  season: number,
): Promise<FtcEvent | null> {
  const eventList = await getSeasonEvents(season, undefined, teamNumber);
  const today = new Date().toISOString().slice(0, 10);

  return (
    (eventList.events || []).find(
      (e) => e.dateStart <= today && e.dateEnd >= today,
    ) || null
  );
}
