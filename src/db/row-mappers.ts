import type {
  CompetitionType,
  CustomEvent,
  CustomEventRow,
  MatchEntry,
  MatchEntryRow,
  Picklist,
  PicklistEntry,
  PicklistEntryRow,
  PicklistNote,
  PicklistNoteRow,
  PicklistRow,
  PitEntry,
  PitEntryRow,
} from "@/lib/types";

import { parseGameSpecificData } from "./row-parsing";

/**
 * Mappers from relational rows to the domain entities. Both SQL providers share
 * the same schema, so they share these conversions.
 */
export function toPitEntry(row: PitEntryRow): PitEntry {
  return {
    id: row.id,
    teamNumber: row.teamNumber,
    year: row.year,
    competitionType: (row.competitionType || "FRC") as CompetitionType,
    driveTrain: row.driveTrain as PitEntry["driveTrain"],
    weight: row.weight ?? undefined,
    length: row.length ?? undefined,
    width: row.width ?? undefined,
    eventName: row.eventName || undefined,
    eventCode: row.eventCode || undefined,
    userId: row.userId || undefined,
    gameSpecificData: parseGameSpecificData(row.gameSpecificData),
    autoDrawing: row.autoDrawing || undefined,
    notes: row.notes || undefined,
  };
}

export function toMatchEntry(row: MatchEntryRow): MatchEntry {
  return {
    id: row.id,
    matchNumber: row.matchNumber,
    teamNumber: row.teamNumber,
    year: row.year,
    competitionType: (row.competitionType || "FRC") as CompetitionType,
    alliance: row.alliance as MatchEntry["alliance"],
    alliancePosition: row.alliancePosition || undefined,
    eventName: row.eventName || undefined,
    eventCode: row.eventCode || undefined,
    userId: row.userId || undefined,
    gameSpecificData: parseGameSpecificData(row.gameSpecificData),
    notes: row.notes,
    timestamp: row.timestamp,
  };
}

export function toCustomEvent(row: CustomEventRow): CustomEvent {
  return {
    id: row.id,
    eventCode: row.eventCode,
    name: row.name,
    date: row.date,
    endDate: row.endDate || undefined,
    matchCount: row.matchCount,
    location: row.location || undefined,
    region: row.region || undefined,
    year: row.year,
    competitionType: (row.competitionType || "FRC") as CompetitionType,
  };
}

export function toPicklist(row: PicklistRow): Picklist {
  return {
    id: row.id,
    eventCode: row.eventCode,
    year: row.year,
    competitionType: (row.competitionType || "FRC") as CompetitionType,
    picklistType: row.picklistType as Picklist["picklistType"],
    name: row.name || undefined,
    createdBy: row.createdBy || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toPicklistEntry(row: PicklistEntryRow): PicklistEntry {
  return {
    id: row.id,
    picklistId: row.picklistId,
    teamNumber: row.teamNumber,
    rank: row.rank,
    source: row.source || undefined,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toPicklistNote(row: PicklistNoteRow): PicklistNote {
  return {
    id: row.id,
    picklistId: row.picklistId,
    teamNumber: row.teamNumber,
    note: row.note,
    created_by: row.created_by || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
