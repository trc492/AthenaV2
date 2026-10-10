import type { CompetitionType } from "../competition/competition";

export interface GuestLinkRecord {
  canAddScouting?: boolean;
  canViewNotes?: boolean;
  id: string;
  token: string;
  name: string;
  eventCode: string;
  year: number;
  competitionType: CompetitionType;
  createdAt: number;
  createdBy: string;
  expiresAt: number;
  revokedAt: number | null;
}
