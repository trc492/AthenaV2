/** FTC Events API Types - Generated from FTC Events API v2.0 Swagger Specification */

/** API Status and Index */
export interface FtcApiStatus {
  name: string | null;
  apiVersion: string | null;
  serviceManifestName: string | null;
  serviceManifestVersion: string | null;
  codePackageName: string | null;
  codePackageVersion: string | null;
  status: string | null;
  currentSeason: number;
  maxSeason: number;
}

/** Team Information */
export interface FtcTeam {
  teamNumber: number;
  displayTeamNumber: string | null;
  nameFull: string | null;
  nameShort: string | null;
  schoolName: string | null;
  city: string | null;
  stateProv: string | null;
  country: string | null;
  website: string | null;
  rookieYear: number | null;
  robotName: string | null;
  districtCode: string | null;
  homeCMP: string | null;
  homeRegion: string | null;
  displayLocation: string | null;
}

/** Simple Team Information */
export interface FtcTeamSimple {
  teamNumber: number;
  displayTeamNumber: string | null;
  nameShort: string | null;
}

/** Event Information */
export interface FtcEvent {
  eventId: string;
  code: string | null;
  divisionCode: string | null;
  name: string | null;
  remote: boolean;
  hybrid: boolean;
  fieldCount: number;
  published: boolean;
  type: string | null;
  typeName: string | null;
  regionCode: string | null;
  leagueCode: string | null;
  districtCode: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  stateprov: string | null;
  country: string | null;
  website: string | null;
  liveStreamUrl: string | null;
  webcasts: string[] | null;
  timezone: string | null;
  dateStart: string;
  dateEnd: string;
}

/** Simple Event Information */
export interface FtcEventSimple {
  code: string | null;
  name: string | null;
  dateStart: string;
  dateEnd: string;
  typeName: string | null;
}

/** League Information */
export interface FtcLeague {
  region: string | null;
  code: string | null;
  name: string | null;
  remote: boolean | null;
  parentLeagueCode: string | null;
  parentLeagueName: string | null;
  location: string | null;
}

/** Match Schedule Information */
export interface FtcScheduledMatch {
  description: string | null;
  field: string | null;
  tournamentLevel: string | null;
  startTime: string | null;
  series: number;
  matchNumber: number;
  teams: FtcScheduledMatchTeam[] | null;
  modifiedOn: string | null;
}

/** Scheduled Match Team */
export interface FtcScheduledMatchTeam {
  teamNumber: number | null;
  displayTeamNumber: string | null;
  station: string | null;
  team: string | null;
  teamName: string | null;
  surrogate: boolean;
  noShow: boolean;
}

/** Match Result Information */
export interface FtcMatchResult {
  actualStartTime: string | null;
  description: string | null;
  tournamentLevel: string | null;
  series: number;
  matchNumber: number;
  scoreRedFinal: number;
  scoreRedFoul: number;
  scoreRedAuto: number;
  scoreBlueFinal: number;
  scoreBlueFoul: number;
  scoreBlueAuto: number;
  postResultTime: string | null;
  teams: FtcMatchResultTeam[] | null;
  modifiedOn: string | null;
}

/** Match Result Team */
export interface FtcMatchResultTeam {
  teamNumber: number;
  station: string | null;
  dq: boolean;
  onField: boolean;
}

/** Team Ranking Information */
export interface FtcTeamRanking {
  rank: number;
  teamNumber: number;
  displayTeamNumber: string | null;
  teamName: string | null;
  sortOrder1: number;
  sortOrder2: number;
  sortOrder3: number;
  sortOrder4: number;
  sortOrder5: number;
  sortOrder6: number;
  wins: number;
  losses: number;
  ties: number;
  qualAverage: number;
  dq: number;
  matchesPlayed: number;
  matchesCounted: number;
}

/** Alliance Information */
export interface FtcAlliance {
  number: number;
  name: string | null;
  captain: number | null;
  captainDisplay: string | null;
  round1: number | null;
  round1Display: string | null;
  round2: number | null;
  round2Display: string | null;
  round3: number | null;
  backup: number | null;
  backupReplaced: number | null;
}

/** Alliance Selection Details */
export interface FtcAllianceSelection {
  alliances: FtcAlliance[] | null;
  count: number;
}

/** Alliance Selection Process Details */
export interface FtcAllianceSelectionDetail {
  selections: FtcAllianceSelectionStep[] | null;
  count: number;
}

/** Alliance Selection Step */
export interface FtcAllianceSelectionStep {
  index: number;
  team: number;
  result: FtcSelectionResult;
}

/** Selection Result Types */
export type FtcSelectionResult = "ACCEPT" | "DECLINE" | "REMOVE" | "CAPTAIN";

/** Advancement Information */
export interface FtcAdvancement {
  advancesTo: string | null;
  slots: number;
  advancement: FtcAdvancementSlot[] | null;
}

/** Advancement Slot */
export interface FtcAdvancementSlot {
  team: number | null;
  teamId: number | null;
  teamProfileId: number | null;
  teamInternalId: string | null;
  displayTeam: string | null;
  slot: number;
  criteria: string | null;
  declined: boolean;
  status: FtcAdvancementStatus;
}

/** Advancement Status Types */
export type FtcAdvancementStatus =
  "NULL" | "FIRST" | "ALREADY_ADVANCING" | "ADVANCING_ABOVE" | "INELIGIBLE";

/** Advancement Source */
export interface FtcAdvancementSource {
  advancedFrom: string | null;
  advancedFromRegion: string | null;
  slots: number;
  advancement: FtcAdvancementSlot[] | null;
}

/** Award Information */
export interface FtcAward {
  awardId: number;
  teamId: number | null;
  teamProfileId: number | null;
  eventId: number | null;
  eventDivisionId: number | null;
  eventCode: string | null;
  name: string | null;
  series: number;
  teamNumber: number | null;
  schoolName: string | null;
  fullTeamName: string | null;
  person: string | null;
}

/** Award Listings */
export interface FtcAwardListing {
  awardId: number;
  name: string | null;
  description: string | null;
  forPerson: boolean;
}

/** League Rankings */
export interface FtcLeagueRanking {
  rankings: FtcTeamRanking[] | null;
}

/** League Members */
export interface FtcLeagueMembers {
  members: number[] | null;
}

/** Season Summary */
export interface FtcSeasonSummary {
  eventCount: number;
  gameName: string | null;
  kickoff: string | null;
  rookieStart: number;
  teamCount: number;
  frcChampionships: FtcChampionship[] | null;
}

/** Championship Information */
export interface FtcChampionship {
  name: string | null;
  startDate: string | null;
  location: string | null;
}

/** Score breakdown per alliance may vary by year—so use generic fallback */
export type FtcScoreBreakdownAlliance = Record<
  string,
  number | string | boolean
>;

/** Overall score breakdown structure (two alliances + extras) */
export interface FtcScoreBreakdown {
  red: FtcScoreBreakdownAlliance;
  blue: FtcScoreBreakdownAlliance;
  [extra: string]: unknown; // e.g. coopertition or shared fields
}

/** Score Details (Generic) */
export interface FtcScoreDetails {
  matchLevel: FtcEventLevel;
  matchSeries: number;
  matchNumber: number;
  score_breakdown: FtcScoreBreakdown;
}

/** Event Level Types */
export type FtcEventLevel =
  "PRACTICE" | "QUALIFICATION" | "SEMIFINAL" | "FINAL" | "PLAYOFF" | "OTHER";

/** Tournament Level Types */
export type FtcTournamentLevel = "qual" | "playoff";

/** Collection Response Types */
export interface FtcEventList {
  events: FtcEvent[] | null;
  eventCount: number;
}

export interface FtcTeamList {
  teams: FtcTeam[] | null;
  teamCountTotal: number;
  teamCountPage: number;
  pageCurrent: number;
  pageTotal: number;
}

export interface FtcLeagueList {
  leagues: FtcLeague[] | null;
  leagueCount: number;
}

export interface FtcMatchSchedule {
  schedule: FtcScheduledMatch[] | null;
}

export interface FtcMatchResults {
  matches: FtcMatchResult[] | null;
}

export interface FtcEventRankings {
  rankings: FtcTeamRanking[] | null;
}

export interface FtcAwardsList {
  awards: FtcAward[] | null;
}

export interface FtcAwardListings {
  awards: FtcAwardListing[] | null;
}

/** Score Details Collection */
export interface FtcScoreDetailsList {
  matchScores: FtcScoreDetails[] | null;
}
