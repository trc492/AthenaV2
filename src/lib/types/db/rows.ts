export interface PitEntryRow {
  id: number;
  teamNumber: number;
  year: number;
  competitionType: string;
  driveTrain: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  eventName: string | null;
  eventCode: string | null;
  userId: string | null;
  gameSpecificData: string;
  autoDrawing: string | null;
  notes: string | null;
}

export interface MatchEntryRow {
  id: number;
  matchNumber: number;
  teamNumber: number;
  year: number;
  competitionType: string;
  alliance: string;
  alliancePosition: number | null;
  eventName: string | null;
  eventCode: string | null;
  userId: string | null;
  gameSpecificData: string;
  notes: string;
  timestamp: Date;
}

export interface CustomEventRow {
  id: number;
  eventCode: string;
  name: string;
  date: Date;
  endDate: Date | null;
  matchCount: number;
  location: string | null;
  region: string | null;
  year: number;
  competitionType: string;
}

export interface PicklistRow {
  id: number;
  eventCode: string;
  year: number;
  competitionType: string;
  picklistType: string;
  name: string | null;
  createdBy: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PicklistEntryRow {
  id: number;
  picklistId: number;
  teamNumber: number;
  rank: number;
  source: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PicklistNoteRow {
  id: number;
  picklistId: number;
  teamNumber: number;
  note: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}
