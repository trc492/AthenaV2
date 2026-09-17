"use client";

// Legacy hard-coded example preserved from the parent of f4badd2.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shell, Waves, ArrowUp, AlertTriangle } from "lucide-react";
import { useTeamData } from "@/hooks/use-team-data";
import Link from "next/link";
import type { MatchupCardProps } from "./matchup-alliance-panel";

interface ReefscapeMatchupData {
  epa: number;
  avg_auto_coral: number;
  avg_auto_algae: number;
  avg_teleop_coral: number;
  avg_teleop_algae: number;
  auto_trough: number;
  auto_l2: number;
  auto_l3: number;
  auto_l4: number;
  auto_net: number;
  auto_processor: number;
  auto_leave_rate: number;
  teleop_trough: number;
  teleop_l2: number;
  teleop_l3: number;
  teleop_l4: number;
  teleop_net: number;
  teleop_processor: number;
  endgame_state: string;
  endgame_none_rate: number;
  endgame_park_rate: number;
  endgame_shallow_rate: number;
  endgame_deep_rate: number;
  avg_fouls: number;
  avg_tech_fouls: number;
}

export function FRCMatchupCard2025({ teamNumber, alliance }: MatchupCardProps) {
  const { teamData, loading, error } = useTeamData(teamNumber);

  const borderColor =
    alliance === "red" ? "border-l-red-500" : "border-l-blue-500";

  const calculateStats = (): ReefscapeMatchupData | null => {
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
          endgame.cage_climb || endgame.ending_robot_state || "none";
        return {
          auto_l1: acc.auto_l1 + (Number(auto.L1_coral) || 0),
          auto_l2: acc.auto_l2 + (Number(auto.L2_coral) || 0),
          auto_l3: acc.auto_l3 + (Number(auto.L3_coral) || 0),
          auto_l4: acc.auto_l4 + (Number(auto.L4_coral) || 0),
          auto_net: acc.auto_net + (Number(auto.net_algae) || 0),
          auto_processor:
            acc.auto_processor + (Number(auto.processor_algae) || 0),
          auto_leave: acc.auto_leave + (auto.leave ? 1 : 0),
          teleop_l1: acc.teleop_l1 + (teleop.L1_coral || 0),
          teleop_l2: acc.teleop_l2 + (teleop.L2_coral || 0),
          teleop_l3: acc.teleop_l3 + (teleop.L3_coral || 0),
          teleop_l4: acc.teleop_l4 + (teleop.L4_coral || 0),
          teleop_net: acc.teleop_net + (teleop.net_algae || 0),
          teleop_processor:
            acc.teleop_processor + (teleop.processor_algae || 0),
          endgame_none: acc.endgame_none + (egState === "none" ? 1 : 0),
          endgame_park: acc.endgame_park + (egState === "park" ? 1 : 0),
          endgame_shallow:
            acc.endgame_shallow + (egState === "shallow" ? 1 : 0),
          endgame_deep: acc.endgame_deep + (egState === "deep" ? 1 : 0),
          fouls: acc.fouls + (fouls.fouls || 0),
          tech_fouls: acc.tech_fouls + (fouls.tech_fouls || 0),
        };
      },
      {
        auto_l1: 0,
        auto_l2: 0,
        auto_l3: 0,
        auto_l4: 0,
        auto_net: 0,
        auto_processor: 0,
        auto_leave: 0,
        teleop_l1: 0,
        teleop_l2: 0,
        teleop_l3: 0,
        teleop_l4: 0,
        teleop_net: 0,
        teleop_processor: 0,
        endgame_none: 0,
        endgame_park: 0,
        endgame_shallow: 0,
        endgame_deep: 0,
        fouls: 0,
        tech_fouls: 0,
      },
    );

    // Determine best endgame state
    const endgameStates = entries.map((m) => {
      const eg = (m.gameSpecificData?.endgame as Record<string, string>) || {};
      return eg.cage_climb || eg.ending_robot_state || "none";
    });
    const stateCounts: Record<string, number> = {};
    endgameStates.forEach((s) => {
      stateCounts[s] = (stateCounts[s] || 0) + 1;
    });
    const bestEndgame =
      Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "none";

    return {
      auto_leave_rate: parseFloat(
        ((totals.auto_leave / count) * 100).toFixed(1),
      ),
      epa: teamData.epa?.totalEPA || 0,
      avg_auto_coral: parseFloat(
        (
          (totals.auto_l1 + totals.auto_l2 + totals.auto_l3 + totals.auto_l4) /
          count
        ).toFixed(1),
      ),
      avg_auto_algae: parseFloat(
        ((totals.auto_processor + totals.auto_net) / count).toFixed(1),
      ),
      avg_teleop_coral: parseFloat(
        (
          (totals.teleop_l1 +
            totals.teleop_l2 +
            totals.teleop_l3 +
            totals.teleop_l4) /
          count
        ).toFixed(1),
      ),
      avg_teleop_algae: parseFloat(
        ((totals.teleop_processor + totals.teleop_net) / count).toFixed(1),
      ),
      auto_trough: parseFloat((totals.auto_l1 / count).toFixed(1)),
      auto_l2: parseFloat((totals.auto_l2 / count).toFixed(1)),
      auto_l3: parseFloat((totals.auto_l3 / count).toFixed(1)),
      auto_l4: parseFloat((totals.auto_l4 / count).toFixed(1)),
      auto_net: parseFloat((totals.auto_net / count).toFixed(1)),
      auto_processor: parseFloat((totals.auto_processor / count).toFixed(1)),
      teleop_trough: parseFloat((totals.teleop_l1 / count).toFixed(1)),
      teleop_l2: parseFloat((totals.teleop_l2 / count).toFixed(1)),
      teleop_l3: parseFloat((totals.teleop_l3 / count).toFixed(1)),
      teleop_l4: parseFloat((totals.teleop_l4 / count).toFixed(1)),
      teleop_net: parseFloat((totals.teleop_net / count).toFixed(1)),
      teleop_processor: parseFloat(
        (totals.teleop_processor / count).toFixed(1),
      ),
      endgame_state: bestEndgame,
      endgame_none_rate: parseFloat(
        ((totals.endgame_none / count) * 100).toFixed(1),
      ),
      endgame_park_rate: parseFloat(
        ((totals.endgame_park / count) * 100).toFixed(1),
      ),
      endgame_shallow_rate: parseFloat(
        ((totals.endgame_shallow / count) * 100).toFixed(1),
      ),
      endgame_deep_rate: parseFloat(
        ((totals.endgame_deep / count) * 100).toFixed(1),
      ),
      avg_fouls: parseFloat((totals.fouls / count).toFixed(1)),
      avg_tech_fouls: parseFloat((totals.tech_fouls / count).toFixed(1)),
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
                <Shell className="h-3 w-3" /> Autonomous
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coral</span>
                  <span className="font-medium">{stats.avg_auto_coral}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Algae</span>
                  <span className="font-medium">{stats.avg_auto_algae}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L4</span>
                  <span className="font-medium">{stats.auto_l4}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L3</span>
                  <span className="font-medium">{stats.auto_l3}</span>
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
                <Waves className="h-3 w-3" /> Teleop
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coral</span>
                  <span className="font-medium">{stats.avg_teleop_coral}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Algae</span>
                  <span className="font-medium">{stats.avg_teleop_algae}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L4</span>
                  <span className="font-medium">{stats.teleop_l4}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L3</span>
                  <span className="font-medium">{stats.teleop_l3}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net</span>
                  <span className="font-medium">{stats.teleop_net}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processor</span>
                  <span className="font-medium">{stats.teleop_processor}</span>
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
                  <span className="text-muted-foreground">Deep</span>
                  <Badge
                    variant={
                      stats.endgame_deep_rate > 50 ? "default" : "secondary"
                    }
                    className="text-xs h-5"
                  >
                    {stats.endgame_deep_rate}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shallow</span>
                  <span className="font-medium">
                    {stats.endgame_shallow_rate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Park</span>
                  <span className="font-medium">
                    {stats.endgame_park_rate}%
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

            {/* Reliability Warning */}
            {(stats.avg_tech_fouls > 0.5 || stats.avg_fouls > 1) && (
              <>
                <Separator className="my-1" />
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div className="flex flex-wrap gap-2">
                    {stats.avg_tech_fouls > 0.5 && (
                      <Badge variant="destructive" className="text-xs">
                        {stats.avg_tech_fouls} tech fouls/match
                      </Badge>
                    )}
                    {stats.avg_fouls > 1 && (
                      <Badge variant="outline" className="text-xs">
                        {stats.avg_fouls} fouls/match
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
                        {!!endgamePit?.climbCapability && (
                          <Badge variant="outline" className="text-xs">
                            Climb: {String(endgamePit.climbCapability)}
                          </Badge>
                        )}
                        {!!teleopPit?.intakeType && (
                          <Badge variant="outline" className="text-xs">
                            Intake: {String(teleopPit.intakeType)}
                          </Badge>
                        )}
                        {teleopPit?.cycleTime != null && (
                          <Badge variant="outline" className="text-xs">
                            Cycle: {String(teleopPit.cycleTime)}s
                          </Badge>
                        )}
                        {!!teleopPit?.reliability && (
                          <Badge variant="outline" className="text-xs">
                            Reliability: {String(teleopPit.reliability)}
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

export default FRCMatchupCard2025;
