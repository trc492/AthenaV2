"use client";

import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import type { CompetitionType } from "@/lib/types";
import { ConfigurableMatchupCard } from "./configurable-matchup-card";

// Props for matchup card components
export interface MatchupCardProps {
  teamNumber: string;
  alliance: "red" | "blue";
}

interface MatchupAlliancePanelProps {
  alliance: "red" | "blue";
  teamNumbers: number[];
  currentYear: number;
  competitionType: CompetitionType;
}

export default function MatchupAlliancePanel({
  alliance,
  teamNumbers,
}: MatchupAlliancePanelProps) {
  const allianceColor =
    alliance === "red"
      ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/20"
      : "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20";

  const allianceLabel = alliance === "red" ? "Red Alliance" : "Blue Alliance";

  return (
    <div className={`rounded-lg border-2 p-4 space-y-4 ${allianceColor}`}>
      <div className="flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full ${alliance === "red" ? "bg-red-500" : "bg-blue-500"}`}
        />
        <h2 className="text-lg font-bold">{allianceLabel}</h2>
        <Badge variant="secondary">{teamNumbers.length} robots</Badge>
      </div>

      <div className="space-y-4">
        {teamNumbers.map((teamNum) => (
          <ConfigurableMatchupCard
            key={teamNum}
            teamNumber={teamNum.toString()}
            alliance={alliance}
          />
        ))}
        {teamNumbers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No teams assigned
          </p>
        )}
      </div>
    </div>
  );
}
