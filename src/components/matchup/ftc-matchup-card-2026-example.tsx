"use client";

// Legacy hard-coded example preserved from the parent of f4badd2.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Puzzle, ArrowUp, AlertTriangle } from "lucide-react";
import { useTeamData } from "@/hooks/use-team-data";
import Link from "next/link";
import type { MatchupCardProps } from "./matchup-alliance-panel";

interface DecodeMatchupData {
  epa: number;
  auto_artifacts_classified: number;
  auto_artifacts_overflow: number;
  auto_patterns: number;
  auto_leave_rate: number;
  teleop_artifacts_classified: number;
  teleop_artifacts_overflow: number;
  teleop_artifacts_depot: number;
  teleop_patterns: number;
  endgame_state: string;
  endgame_none_rate: number;
  endgame_partial_rate: number;
  endgame_full_rate: number;
  avg_minor_penalties: number;
  avg_major_penalties: number;
}

export function FTCMatchupCard2026({ teamNumber, alliance }: MatchupCardProps) {
  const { teamData, loading, error } = useTeamData(teamNumber);

  const borderColor =
    alliance === "red" ? "border-l-red-500" : "border-l-blue-500";

  const calculateStats = (): DecodeMatchupData | null => {
    if (!teamData?.matchEntries || teamData.matchEntries.length === 0)
      return null;

    const entries = teamData.matchEntries;
    const count = entries.length;

    const totals = entries.reduce(
      (acc, match) => {
        const auto =
          (match.gameSpecificData?.autonomous as Record<
            string,
            number | boolean
          >) || {};
        const teleop =
          (match.gameSpecificData?.teleop as Record<string, number>) || {};
        const endgame =
          (match.gameSpecificData?.endgame as Record<string, string>) || {};
        const fouls =
          (match.gameSpecificData?.fouls as Record<string, number>) || {};
        const egState =
          endgame.ending_based_state || endgame.ending_robot_state || "none";
        return {
          auto_artifacts_classified:
            acc.auto_artifacts_classified +
            (Number(auto.artifacts_classified) || 0),
          auto_artifacts_overflow:
            acc.auto_artifacts_overflow +
            (Number(auto.artifacts_overflow) || 0),
          auto_patterns: acc.auto_patterns + (Number(auto.patterns) || 0),
          auto_leave: acc.auto_leave + (auto.leave ? 1 : 0),
          teleop_artifacts_classified:
            acc.teleop_artifacts_classified +
            (teleop.artifacts_classified || 0),
          teleop_artifacts_overflow:
            acc.teleop_artifacts_overflow + (teleop.artifacts_overflow || 0),
          teleop_artifacts_depot:
            acc.teleop_artifacts_depot + (teleop.artifacts_depot || 0),
          teleop_patterns: acc.teleop_patterns + (teleop.patterns || 0),
          endgame_none: acc.endgame_none + (egState === "none" ? 1 : 0),
          endgame_partial:
            acc.endgame_partial + (egState === "partial" ? 1 : 0),
          endgame_full: acc.endgame_full + (egState === "full" ? 1 : 0),
          minor_penalties: acc.minor_penalties + (fouls.minor_penalties || 0),
          major_penalties: acc.major_penalties + (fouls.major_penalties || 0),
        };
      },
      {
        auto_artifacts_classified: 0,
        auto_artifacts_overflow: 0,
        auto_patterns: 0,
        auto_leave: 0,
        teleop_artifacts_classified: 0,
        teleop_artifacts_overflow: 0,
        teleop_artifacts_depot: 0,
        teleop_patterns: 0,
        endgame_none: 0,
        endgame_partial: 0,
        endgame_full: 0,
        minor_penalties: 0,
        major_penalties: 0,
      },
    );

    // Determine best endgame state
    const endgameStates = entries.map((m) => {
      const eg = (m.gameSpecificData?.endgame as Record<string, string>) || {};
      return eg.ending_robot_state || eg.climb_state || "none";
    });
    const stateCounts: Record<string, number> = {};
    endgameStates.forEach((s) => {
      stateCounts[s] = (stateCounts[s] || 0) + 1;
    });
    const bestEndgame =
      Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

    return {
      epa: teamData.epa?.totalEPA || 0,
      auto_artifacts_classified: parseFloat(
        (totals.auto_artifacts_classified / count).toFixed(1),
      ),
      auto_artifacts_overflow: parseFloat(
        (totals.auto_artifacts_overflow / count).toFixed(1),
      ),
      auto_patterns: parseFloat((totals.auto_patterns / count).toFixed(1)),
      auto_leave_rate: parseFloat(
        ((totals.auto_leave / count) * 100).toFixed(1),
      ),
      teleop_artifacts_classified: parseFloat(
        (totals.teleop_artifacts_classified / count).toFixed(1),
      ),
      teleop_artifacts_overflow: parseFloat(
        (totals.teleop_artifacts_overflow / count).toFixed(1),
      ),
      teleop_artifacts_depot: parseFloat(
        (totals.teleop_artifacts_depot / count).toFixed(1),
      ),
      teleop_patterns: parseFloat((totals.teleop_patterns / count).toFixed(1)),
      endgame_state: bestEndgame,
      endgame_none_rate: parseFloat(
        ((totals.endgame_none / count) * 100).toFixed(1),
      ),
      endgame_partial_rate: parseFloat(
        ((totals.endgame_partial / count) * 100).toFixed(1),
      ),
      endgame_full_rate: parseFloat(
        ((totals.endgame_full / count) * 100).toFixed(1),
      ),
      avg_minor_penalties: parseFloat(
        (totals.minor_penalties / count).toFixed(1),
      ),
      avg_major_penalties: parseFloat(
        (totals.major_penalties / count).toFixed(1),
      ),
    };
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <Card className={`border-l-4 ${borderColor}`}>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !teamData) {
    return (
      <Card className={`border-l-4 ${borderColor}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <Link
              href={`/dashboard/team/${teamNumber}`}
              className="hover:underline font-bold"
            >
              Team {teamNumber}
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No scouting data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            <Link
              href={`/dashboard/team/${teamNumber}`}
              className="hover:underline font-bold text-lg"
            >
              Team {teamNumber}
            </Link>
          </CardTitle>
          <div className="flex items-center gap-2">
            {teamData.pitEntry?.driveTrain && (
              <Badge variant="outline" className="text-xs">
                {teamData.pitEntry.driveTrain}
              </Badge>
            )}
            {teamData.pitEntry?.weight && (
              <Badge variant="outline" className="text-xs">
                {teamData.pitEntry.weight} lbs
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {teamData.matchCount} matches
          </Badge>
          {stats && (
            <Badge variant="secondary" className="text-xs">
              EPA: {stats.epa.toFixed(1)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats ? (
          <>
            {/* Autonomous Summary */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Package className="h-3 w-3" /> Autonomous
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Classified</span>
                  <span className="font-medium">
                    {stats.auto_artifacts_classified}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overflow</span>
                  <span className="font-medium">
                    {stats.auto_artifacts_overflow}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patterns</span>
                  <Badge
                    variant={stats.auto_patterns > 0 ? "default" : "secondary"}
                    className="text-xs h-5"
                  >
                    {stats.auto_patterns}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leave Rate</span>
                  <Badge
                    variant={
                      stats.auto_leave_rate > 80 ? "default" : "secondary"
                    }
                    className="text-xs h-5"
                  >
                    {stats.auto_leave_rate}%
                  </Badge>
                </div>
              </div>
            </div>

            <Separator className="my-1" />

            {/* Teleop Summary */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Puzzle className="h-3 w-3" /> Teleop
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Classified</span>
                  <span className="font-medium">
                    {stats.teleop_artifacts_classified}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overflow</span>
                  <span className="font-medium">
                    {stats.teleop_artifacts_overflow}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depot</span>
                  <span className="font-medium">
                    {stats.teleop_artifacts_depot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patterns</span>
                  <Badge
                    variant={
                      stats.teleop_patterns > 0 ? "default" : "secondary"
                    }
                    className="text-xs h-5"
                  >
                    {stats.teleop_patterns}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator className="my-1" />

            {/* Endgame Summary */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <ArrowUp className="h-3 w-3" /> Endgame
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Full</span>
                  <Badge
                    variant={
                      stats.endgame_full_rate > 50 ? "default" : "secondary"
                    }
                    className="text-xs h-5"
                  >
                    {stats.endgame_full_rate}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Partial</span>
                  <span className="font-medium">
                    {stats.endgame_partial_rate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">None</span>
                  <span className="font-medium">
                    {stats.endgame_none_rate}%
                  </span>
                </div>
              </div>
            </div>

            {/* Penalty Warning */}
            {(stats.avg_major_penalties > 0.3 ||
              stats.avg_minor_penalties > 1) && (
              <>
                <Separator className="my-1" />
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div className="flex flex-wrap gap-2">
                    {stats.avg_major_penalties > 0.3 && (
                      <Badge variant="destructive" className="text-xs">
                        {stats.avg_major_penalties} major/match
                      </Badge>
                    )}
                    {stats.avg_minor_penalties > 1 && (
                      <Badge variant="outline" className="text-xs">
                        {stats.avg_minor_penalties} minor/match
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Pit Scouting Capabilities */}
            {teamData?.pitEntry?.gameSpecificData &&
              (() => {
                const pitData = teamData.pitEntry.gameSpecificData as Record<
                  string,
                  Record<string, unknown>
                >;
                const endgamePit = pitData.endgame;
                const teleopPit = pitData.teleoperated;
                if (!endgamePit && !teleopPit) return null;
                return (
                  <>
                    <Separator className="my-1" />
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Pit Report
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {!!endgamePit?.baseCapability && (
                          <Badge variant="outline" className="text-xs">
                            Base: {String(endgamePit.baseCapability)}
                          </Badge>
                        )}
                        {!!teleopPit?.artifactIntake && (
                          <Badge variant="outline" className="text-xs">
                            Intake: {String(teleopPit.artifactIntake)}
                          </Badge>
                        )}
                        {!!teleopPit?.shootingReliability && (
                          <Badge variant="outline" className="text-xs">
                            Shooting: {String(teleopPit.shootingReliability)}
                          </Badge>
                        )}
                        {teleopPit?.cycleTime != null && (
                          <Badge variant="outline" className="text-xs">
                            Cycle: {String(teleopPit.cycleTime)}s
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No match data to analyze
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default FTCMatchupCard2026;
