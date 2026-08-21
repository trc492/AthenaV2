import type { CompetitionType } from "../competition/competition";
import type { CustomEvent, MatchEntry, PitEntry } from "./entries";
import type {
  Picklist,
  PicklistEntry,
  PicklistNote,
} from "../picklist/picklist";

export interface DatabaseService {
  getPool?(): Promise<any>;
  query?<T = any>(
    sql: string,
    params?: Record<string, unknown>,
  ): Promise<{ recordset: T[] }>;

  addPitEntry(entry: Omit<PitEntry, "id">): Promise<number>;
  getPitEntry(
    teamNumber: number,
    year: number,
    competitionType?: CompetitionType,
  ): Promise<PitEntry | undefined>;
  getAllPitEntries(
    year?: number,
    eventCode?: string,
    competitionType?: CompetitionType,
  ): Promise<PitEntry[]>;
  updatePitEntry(id: number, updates: Partial<PitEntry>): Promise<void>;
  deletePitEntry(id: number): Promise<void>;
  checkPitScoutExists(teamNumber: number, eventCode: string): Promise<boolean>;

  addMatchEntry(entry: Omit<MatchEntry, "id">): Promise<number>;
  getMatchEntries(
    teamNumber: number,
    year?: number,
    competitionType?: CompetitionType,
  ): Promise<MatchEntry[]>;
  getAllMatchEntries(
    year?: number,
    eventCode?: string,
    competitionType?: CompetitionType,
  ): Promise<MatchEntry[]>;
  updateMatchEntry(id: number, updates: Partial<MatchEntry>): Promise<void>;
  deleteMatchEntry(id: number): Promise<void>;
  checkMatchScoutExists(
    teamNumber: number,
    matchNumber: number,
    eventCode: string,
  ): Promise<boolean>;

  addCustomEvent(event: Omit<CustomEvent, "id">): Promise<number>;
  getCustomEvent(
    eventCode: string,
    competitionType?: CompetitionType,
  ): Promise<CustomEvent | undefined>;
  getAllCustomEvents(
    year?: number,
    competitionType?: CompetitionType,
  ): Promise<CustomEvent[]>;
  updateCustomEvent(
    eventCode: string,
    updates: Partial<CustomEvent>,
  ): Promise<void>;
  deleteCustomEvent(eventCode: string): Promise<void>;

  updateUserPreferredPartners(
    userId: string,
    preferredPartners: string[],
  ): Promise<void>;
  getUserPreferredPartners(userId: string): Promise<string[]>;

  addPicklist(
    picklist: Omit<Picklist, "id" | "created_at" | "updated_at">,
  ): Promise<number>;
  getPicklist(id: number): Promise<Picklist | undefined>;
  getPicklistByEvent(
    eventCode: string,
    year: number,
    competitionType: CompetitionType,
    picklistType?: string,
  ): Promise<Picklist | undefined>;
  getPicklistsByEvent(
    eventCode: string,
    year: number,
    competitionType: CompetitionType,
  ): Promise<Picklist[]>;
  updatePicklist(id: number, updates: Partial<Picklist>): Promise<void>;
  deletePicklist(id: number): Promise<void>;

  addPicklistEntry(
    entry: Omit<PicklistEntry, "id" | "created_at" | "updated_at">,
  ): Promise<number>;
  getPicklistEntry(id: number): Promise<PicklistEntry | undefined>;
  getPicklistEntries(picklistId: number): Promise<PicklistEntry[]>;
  updatePicklistEntry(
    id: number,
    updates: Partial<PicklistEntry>,
  ): Promise<void>;
  deletePicklistEntry(id: number): Promise<void>;
  updatePicklistEntryRank(
    picklistId: number,
    teamNumber: number,
    rank: number,
  ): Promise<void>;
  reorderPicklistEntries(
    picklistId: number,
    entries: Array<{ teamNumber: number; rank: number }>,
  ): Promise<void>;

  addPicklistNote(
    note: Omit<PicklistNote, "id" | "created_at" | "updated_at">,
  ): Promise<number>;
  getPicklistNote(id: number): Promise<PicklistNote | undefined>;
  getPicklistNotes(
    picklistId: number,
    teamNumber?: number,
  ): Promise<PicklistNote[]>;
  updatePicklistNote(id: number, updates: Partial<PicklistNote>): Promise<void>;
  deletePicklistNote(id: number): Promise<void>;

  exportData(
    year?: number,
    competitionType?: CompetitionType,
  ): Promise<{ pitEntries: PitEntry[]; matchEntries: MatchEntry[] }>;
  importData(data: {
    pitEntries: PitEntry[];
    matchEntries: MatchEntry[];
  }): Promise<void>;
  resetDatabase(): Promise<void>;
  syncToCloud?(): Promise<void>;
  syncFromCloud?(): Promise<void>;
}

export type DatabaseProvider =
  | "azuresql"
  | "firebase"
  | "cosmos"
  | "mariadb";

export interface AzureSqlConfig {
  server?: string;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
  useManagedIdentity?: boolean;
}

export interface FirebaseConfig {
  serviceAccountPath?: string;
  serviceAccountJson?: Record<string, unknown>;
  databaseURL?: string;
}

export interface CosmosConfig {
  endpoint?: string;
  key?: string;
  databaseId?: string;
  containerId?: string;
}
export interface MariaDbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}
export interface DatabaseConfig {
  provider: DatabaseProvider;
  azuresql?: AzureSqlConfig;
  firebase?: FirebaseConfig;
  cosmos?: CosmosConfig;
  mariadb?: MariaDbConfig;
}
