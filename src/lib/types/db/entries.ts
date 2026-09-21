import type { CompetitionType } from "../competition/competition";
import type { Event } from "../events/events";

export interface PitEntry {
  id?: number;
  teamNumber: number;
  year: number;
  competitionType: CompetitionType;
  driveTrain: "Swerve" | "Mecanum" | "Tank" | "Other";
  weight?: number;
  length?: number;
  width?: number;
  eventName?: string;
  eventCode?: string;
  userId?: string;
  gameSpecificData: Record<
    string,
    number | string | boolean | Record<string, number | string | boolean>
  >;
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
  gameSpecificData: Record<
    string,
    number | string | boolean | Record<string, number | string | boolean>
  >;
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
