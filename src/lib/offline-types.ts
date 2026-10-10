// Offline data types for IndexedDB storage and synchronization
// Handles caching of pit and match scouting data when offline

import type { CompetitionType, Event, MatchEntry, PitEntry } from "@/lib/types";

// Status of a queued entry
export type SyncStatus = "pending" | "syncing" | "synced" | "error";

// Base interface for queued data entries
export interface QueuedEntry {
  id: string; // UUID for the queued entry
  type: "pit" | "match";
  status: SyncStatus;
  data: Omit<PitEntry, "id"> | Omit<MatchEntry, "id">;
  createdAt: Date;
  lastAttempt?: Date;
  attempts: number;
  error?: string;
  remoteId?: number; // ID from the server after successful sync
}

// Queued pit scouting entry
export interface QueuedPitEntry extends QueuedEntry {
  type: "pit";
  data: Omit<PitEntry, "id">;
}

// Queued match scouting entry
export interface QueuedMatchEntry extends QueuedEntry {
  type: "match";
  data: Omit<MatchEntry, "id">;
}

// Sync configuration
export interface SyncConfig {
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
  autoSyncEnabled: boolean;
}

// Sync result for tracking sync operations
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
  timestamp: Date;
}

// Result for queued-entry deduplication
export interface DedupeQueueResult {
  removedCount: number;
  removedEntryIds: string[];
  remainingUnsyncedCount: number;
  remainingPendingCount: number;
}

// Network status tracking
export interface NetworkStatus {
  isOnline: boolean;
  lastOnline?: Date;
  lastOffline?: Date;
}

export interface EventScope {
  eventCode: string;
  competitionType: CompetitionType;
  year: number;
}

export function eventScopeKey(scope: EventScope): [string, number, CompetitionType] {
  return [scope.eventCode, scope.year, scope.competitionType];
}

// Cached team info for offline scouting
export interface CachedTeamInfo {
  teamNumber: number;
  nickname: string;
  key: string;
}

// Cached event teams data
export interface CachedEventTeams extends EventScope {
  teams: CachedTeamInfo[];
  cachedAt: Date;
}

// Cached event list data
export interface CachedEventList {
  teamNumber: number;
  competitionType: string;
  year: number;
  events: Array<Event>;
  cachedAt: Date;
}

// Cached scout list for tablet accounts
export interface CachedScoutList {
  scouts: Array<{
    id: string;
    name: string;
    username: string;
    role: string;
  }>;
  cachedAt: Date;
}

// ============================================
// Event Data Cache types (full offline mode)
// ============================================

// Metadata about what is cached for each event
export interface EventCacheStatus extends EventScope {
  eventName: string;
  cachedAt: Date;
  pitEntryCount: number;
  matchEntryCount: number;
  teamCount: number;
  schedulesCached: boolean;
  pagesCached: boolean;
  sessionCached: boolean;
}

// Cached pit entries for an event (stored in bulk)
export interface CachedPitEntries extends EventScope {
  entries: PitEntry[];
  cachedAt: Date;
}

// Cached match entries for an event (stored in bulk)
export interface CachedMatchEntries extends EventScope {
  entries: MatchEntry[];
  cachedAt: Date;
}

// Cached analysis data for an event
export interface CachedAnalysisData extends EventScope {
  data: import("@/lib/types").AnalysisData;
  cachedAt: Date;
}

// IndexedDB schema version - increment when adding new stores
export const DB_VERSION = 6;
export const DB_NAME = "athena-offline-cache";

// Store names
export const STORES = {
  QUEUE: "queue",
  SYNC_LOG: "sync_log",
  CONFIG: "config",
  EVENT_TEAMS: "event_teams",
  EVENT_LIST: "event_list",
  SCOUT_LIST: "scout_list",
  CACHED_PIT_ENTRIES: "cached_pit_entries",
  CACHED_MATCH_ENTRIES: "cached_match_entries",
  CACHED_ANALYSIS_DATA: "cached_analysis_data",
  EVENT_CACHE_STATUS: "event_cache_status",
} as const;
