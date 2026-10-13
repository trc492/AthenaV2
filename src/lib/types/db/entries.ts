import type { CompetitionType } from "../competition/competition";
import type { Event } from "../events/events";

export const DRIVE_TRAINS = [
  "Swerve",
  "Mecanum",
  "Tank",
  "West Coast",
  "Omni",
  "Other",
] as const;
export type DriveTrain = (typeof DRIVE_TRAINS)[number];

/** Map any casing/slug ("swerve", "west-coast", "WEST COAST") to its canonical label. */
export const normalizeDriveTrain = (value: unknown): DriveTrain | undefined => {
  const key = String(value ?? "").trim().toLowerCase().replace(/[-_\s]+/g, " ");
  return DRIVE_TRAINS.find((d) => d.toLowerCase() === key);
};

/** Inverse of normalizeDriveTrain: the slug used as the pit form's select value. */
export const driveTrainSlug = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "-");

type GameScalar = number | string | boolean;
type GameValue = GameScalar | GameScalar[];

export interface PitEntry {
  id?: number;
  teamNumber: number;
  year: number;
  competitionType: CompetitionType;
  driveTrain: DriveTrain;
  weight?: number;
  length?: number;
  width?: number;
  eventName?: string;
  eventCode?: string;
  userId?: string;
  gameSpecificData: Record<string, GameValue | Record<string, GameValue>>;
  autoDrawing?: string;
  notes?: string;
}

export interface MatchEntry {
  id?: number;
  matchNumber: number;
  teamNumber: number;
  year: number;
  competitionType: CompetitionType;
  alliance: "red" | "blue";
  alliancePosition?: number;
  eventName?: string;
  eventCode?: string;
  userId?: string;
  gameSpecificData: Record<string, GameValue | Record<string, GameValue>>;
  notes: string;
  timestamp: Date;
}

export interface CustomEvent extends Event {
  id?: number;
  date: Date;
  endDate?: Date;
  matchCount: number;
  location?: string;
  year: number;
  competitionType: CompetitionType;
}
