import type { CompetitionType } from "../competition/competition";

export interface Picklist {
  id?: number;
  eventCode: string;
  year: number;
  competitionType: CompetitionType;
  picklistType: "pick1" | "pick2" | "blacklist" | "main";
  /** Optional display name; persisted by the SQL providers. */
  name?: string;
  /** Id of the user who created the list; persisted by the SQL providers. */
  createdBy?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PicklistEntry {
  id?: number;
  picklistId: number;
  teamNumber: number;
  rank: number;
  /** Where the pick came from, e.g. manual entry vs. import. */
  source?: string;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PicklistNote {
  id?: number;
  picklistId: number;
  teamNumber: number;
  note: string;
  created_by?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PicklistData {
  teams: Array<{
    teamNumber: number;
    name: string;
    driveTrain: string;
    weight: number;
    length: number;
    width: number;
    matchesPlayed: number;
    totalEPA: number;
    autoEPA: number;
    teleopEPA: number;
    endgameEPA: number;
    rank: number;
  }>;
  totalTeams: number;
  lastUpdated: string;
}
