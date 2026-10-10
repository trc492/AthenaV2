// API client for database operations with offline support
// Handles online/offline scenarios by queuing data when offline

import { HttpError, requestJSON } from "@/lib/fetcher";
import { offlineQueueManager } from "@/lib/offline-queue-manager";
import type {
  AnalysisData,
  DashboardStats,
  PicklistData,
  TeamData,
} from "@/lib/types";
import { MatchEntry, PitEntry } from "@/lib/types";

const NETWORK_TIMEOUT = 8000;

// Result type for create operations that may be queued
export interface CreateResult {
  id?: number; // Server ID if synced immediately
  queueId?: string; // Queue ID if stored offline
  isQueued: boolean;
}

const SCOUTING_BASE = "/api/scouting";
const ENTRIES_BASE = `${SCOUTING_BASE}/entries`;
const ANALYSIS_BASE = `${SCOUTING_BASE}/analysis`;
const PICKLIST_BASE = `${SCOUTING_BASE}/picklist`;

/** Both entry types use the same submission and retry policy. */
async function createEntry<T>(
  kind: "pit" | "match",
  entry: T,
  queue: (entry: T) => Promise<string>,
): Promise<CreateResult> {
  const enqueue = async (): Promise<CreateResult> => ({
    queueId: await queue(entry), isQueued: true,
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) return enqueue();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);
  try {
    const result = await requestJSON<{ id: number }>(`${ENTRIES_BASE}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      signal: controller.signal,
    }, `Failed to create ${kind} entry`);
    return { id: result.id, isQueued: false };
  } catch (error) {
    if ((error instanceof HttpError && error.status >= 500) ||
      error instanceof TypeError ||
      (error instanceof Error && error.name === "AbortError")) return enqueue();
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Pit scouting operations
export const pitApi = {
  // Get all pit entries or filter by year/team
  async getAll(year?: number): Promise<PitEntry[]> {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());

    return requestJSON(`${ENTRIES_BASE}/pit?${params}`, {}, "Failed to fetch pit entries");
  },

  async getByTeam(teamNumber: number, year?: number): Promise<PitEntry | null> {
    const params = new URLSearchParams();
    params.append("teamNumber", teamNumber.toString());
    if (year) params.append("year", year.toString());

    return requestJSON(`${ENTRIES_BASE}/pit?${params}`, {}, "Failed to fetch pit entry");
  },

  async create(entry: Omit<PitEntry, "id">): Promise<CreateResult> {
    return createEntry("pit", entry, (data) => offlineQueueManager.queuePitEntry(data));
  },

  async update(id: number, updates: Partial<PitEntry>): Promise<void> {
    await requestJSON(`${ENTRIES_BASE}/pit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, id }),
    });

  },

  async delete(id: number): Promise<void> {
    await requestJSON(`${ENTRIES_BASE}/pit?id=${id}`, {
      method: "DELETE",
    });

  },
};

// Match scouting operations
export const matchApi = {
  async getAll(year?: number): Promise<MatchEntry[]> {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());

    return requestJSON(`${ENTRIES_BASE}/match?${params}`, {}, "Failed to fetch match entries");
  },

  async getByTeam(teamNumber: number, year?: number): Promise<MatchEntry[]> {
    const params = new URLSearchParams();
    params.append("teamNumber", teamNumber.toString());
    if (year) params.append("year", year.toString());

    return requestJSON(`${ENTRIES_BASE}/match?${params}`, {}, "Failed to fetch match entries");
  },

  async create(entry: Omit<MatchEntry, "id">): Promise<CreateResult> {
    return createEntry("match", entry, (data) => offlineQueueManager.queueMatchEntry(data));
  },

  async update(id: number, updates: Partial<MatchEntry>): Promise<void> {
    await requestJSON(`${ENTRIES_BASE}/match`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, id }),
    });

  },

  async delete(id: number): Promise<void> {
    await requestJSON(`${ENTRIES_BASE}/match?id=${id}`, {
      method: "DELETE",
    });

  },
};

// Statistics and analysis operations
export const statsApi = {
  async getDashboardStats(
    year?: number,
    eventCode?: string,
    competitionType?: string,
  ): Promise<DashboardStats> {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());
    if (eventCode) params.append("eventCode", eventCode);
    if (competitionType) params.append("competitionType", competitionType);

    return requestJSON(`${ANALYSIS_BASE}/stats?${params}`, {}, "Failed to fetch dashboard stats");
  },

  async getAnalysisData(
    year?: number,
    eventCode?: string,
    competitionType?: string,
    includeBoxPlot?: boolean,
  ): Promise<AnalysisData> {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());
    if (eventCode) params.append("eventCode", eventCode);
    if (competitionType) params.append("competitionType", competitionType);
    if (includeBoxPlot) params.append("includeBoxPlot", "true");

    return requestJSON(`${ANALYSIS_BASE}/analysis?${params}`, {}, "Failed to fetch analysis data");
  },

  async getPicklistData(
    year?: number,
    eventCode?: string,
    competitionType?: string,
  ): Promise<PicklistData> {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());
    if (eventCode) params.append("eventCode", eventCode);
    if (competitionType) params.append("competitionType", competitionType);

    return requestJSON(`${PICKLIST_BASE}?${params}`, {}, "Failed to fetch picklist data");
  },
};

// Team data operations
export const teamApi = {
  async getTeamData(
    teamNumber: number,
    year?: number,
    eventCode?: string,
    competitionType?: string,
  ): Promise<TeamData> {
    const params = new URLSearchParams();
    params.append("teamNumber", teamNumber.toString());
    if (year) params.append("year", year.toString());
    if (eventCode) params.append("eventCode", eventCode);
    if (competitionType) params.append("competitionType", competitionType);

    return requestJSON(`${ENTRIES_BASE}/team?${params}`, {}, "Failed to fetch team data");
  },
};
