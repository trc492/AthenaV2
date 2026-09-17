"use client";

// Legacy hard-coded example preserved from the parent of f4badd2.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Flame, ArrowUp, AlertTriangle } from "lucide-react";
import { useTeamData } from "@/hooks/use-team-data";
import Link from "next/link";
import type { MatchupCardProps } from "./matchup-alliance-panel";

interface RebuiltMatchupData {
  avg_total: number;
  epa: number;
  auto_fuel_scored: number;
  auto_fuel_missed: number;
  auto_fuel_shuttled: number;
  auto_climb_rate: number;
  teleop_fuel_scored: number;
  teleop_fuel_missed: number;
  teleop_fuel_passed: number;
  teleop_fuel_corraled: number;
  teleop_fuel_shuttled: number;
  teleop_fuel_accuracy: number;
  endgame_breakdown_rate: number;
  endgame_none_rate: number;
  endgame_l1_rate: number;
  endgame_l2_rate: number;
  endgame_l3_rate: number;
  playstyle_defensive_rate: number;
  playstyle_balanced_rate: number;
  playstyle_offensive_rate: number;
  avg_fouls: number;
  avg_tech_fouls: number;
}

export function FRCMatchupCard2026({ teamNumber, alliance }: MatchupCardProps) {
  const { teamData, loading, error } = useTeamData(teamNumber);

  const borderColor =
    alliance === "red" ? "border-l-red-500" : "border-l-blue-500";

  const calculateStats = (): RebuiltMatchupData | null => {
    if (!teamData?.matchEntries || teamData.matchEntries.length === 0)
      return null;

    const entries = teamData.matchEntries;
    const count = entries.length;

    const totals = entries.reduce(
      (acc, match) => {
        const auto =
          (match.gameSpecificData?.autonomous as Record<string, number>) || {};
        const teleop =
          (match.gameSpecificData?.teleop as Record<string, number>) || {};
        const endgame =
          (match.gameSpecificData?.endgame as Record<
            string,
            string | number | boolean
          >) || {};
        const fouls =
          (match.gameSpecificData?.fouls as Record<string, number>) || {};

        return {
          auto_fuel_scored: acc.auto_fuel_scored + (auto.fuel_scored || 0),
          auto_fuel_missed: acc.auto_fuel_missed + (auto.fuel_missed || 0),
          auto_fuel_shuttled:
            acc.auto_fuel_shuttled + (auto.fuel_shuttled || 0),
          auto_climb: acc.auto_climb + (auto.climb ? 1 : 0),
          teleop_fuel_scored:
            acc.teleop_fuel_scored + (teleop.fuel_scored || 0),
          teleop_fuel_missed:
            acc.teleop_fuel_missed + (teleop.fuel_missed || 0),
          teleop_fuel_passed:
            acc.teleop_fuel_passed + (teleop.fuel_passed || 0),
          teleop_fuel_corraled:
            acc.teleop_fuel_corraled + (teleop.fuel_corraled || 0),
          teleop_fuel_shuttled:
            acc.teleop_fuel_shuttled + (teleop.fuel_shuttled || 0),
          endgame_broke_down:
            acc.endgame_broke_down + (endgame.robot_broke_down ? 1 : 0),
          endgame_none:
            acc.endgame_none +
            (endgame.ending_robot_state === "none" ||
            !endgame.ending_robot_state
              ? 1
              : 0),
          endgame_l1:
            acc.endgame_l1 + (endgame.ending_robot_state === "L1" ? 1 : 0),
          endgame_l2:
            acc.endgame_l2 + (endgame.ending_robot_state === "L2" ? 1 : 0),
          endgame_l3:
            acc.endgame_l3 + (endgame.ending_robot_state === "L3" ? 1 : 0),
          playstyle_defensive:
            acc.playstyle_defensive +
            (endgame.robot_playstyle === "defensive" ? 1 : 0),
          playstyle_balanced:
            acc.playstyle_balanced +
            (endgame.robot_playstyle === "balanced" ? 1 : 0),
          playstyle_offensive:
            acc.playstyle_offensive +
            (endgame.robot_playstyle === "offensive" ? 1 : 0),
          fouls: acc.fouls + (fouls.fouls || 0),
          tech_fouls: acc.tech_fouls + (fouls.tech_fouls || 0),
        };
      },
      {
        auto_fuel_scored: 0,
        auto_fuel_missed: 0,
        auto_fuel_shuttled: 0,
        auto_climb: 0,
        teleop_fuel_scored: 0,
        teleop_fuel_missed: 0,
        teleop_fuel_passed: 0,
        teleop_fuel_corraled: 0,
        teleop_fuel_shuttled: 0,
        endgame_broke_down: 0,
        endgame_none: 0,
        endgame_l1: 0,
        endgame_l2: 0,
        endgame_l3: 0,
        playstyle_defensive: 0,
        playstyle_balanced: 0,
        playstyle_offensive: 0,
        fouls: 0,
        tech_fouls: 0,
      },
    );

    const totalShots = totals.teleop_fuel_scored + totals.teleop_fuel_missed;

    return {
      avg_total: teamData.epa?.totalEPA || 0,
      epa: teamData.epa?.totalEPA || 0,
      auto_fuel_scored: parseFloat(
        (totals.auto_fuel_scored / count).toFixed(1),
      ),
      auto_fuel_missed: parseFloat(
        (totals.auto_fuel_missed / count).toFixed(1),
      ),
      auto_fuel_shuttled: parseFloat(
        (totals.auto_fuel_shuttled / count).toFixed(1),
      ),
      auto_climb_rate: parseFloat(
        ((totals.auto_climb / count) * 100).toFixed(1),
      ),
      teleop_fuel_scored: parseFloat(
        (totals.teleop_fuel_scored / count).toFixed(1),
      ),
      teleop_fuel_missed: parseFloat(
        (totals.teleop_fuel_missed / count).toFixed(1),
      ),
      teleop_fuel_passed: parseFloat(
        (totals.teleop_fuel_passed / count).toFixed(1),
      ),
      teleop_fuel_corraled: parseFloat(
        (totals.teleop_fuel_corraled / count).toFixed(1),
      ),
      teleop_fuel_shuttled: parseFloat(
        (totals.teleop_fuel_shuttled / count).toFixed(1),
      ),
      teleop_fuel_accuracy:
        totalShots > 0
          ? parseFloat(
              ((totals.teleop_fuel_scored / totalShots) * 100).toFixed(1),
            )
          : 0,
      endgame_breakdown_rate: parseFloat(
        ((totals.endgame_broke_down / count) * 100).toFixed(1),
      ),
      endgame_none_rate: parseFloat(
        ((totals.endgame_none / count) * 100).toFixed(1),
      ),
      endgame_l1_rate: parseFloat(
        ((totals.endgame_l1 / count) * 100).toFixed(1),
      ),
      endgame_l2_rate: parseFloat(
        ((totals.endgame_l2 / count) * 100).toFixed(1),
      ),
      endgame_l3_rate: parseFloat(
        ((totals.endgame_l3 / count) * 100).toFixed(1),
      ),
      playstyle_defensive_rate: parseFloat(
        ((totals.playstyle_defensive / count) * 100).toFixed(1),
      ),
      playstyle_balanced_rate: parseFloat(
        ((totals.playstyle_balanced / count) * 100).toFixed(1),
      ),
      playstyle_offensive_rate: parseFloat(
        ((totals.playstyle_offensive / count) * 100).toFixed(1),
      ),
      avg_fouls: parseFloat((totals.fouls / count).toFixed(1)),
      avg_tech_fouls: parseFloat((totals.tech_fouls / count).toFixed(1)),
    };
  };

  const stats = calculateStats();
  const bestClimb = stats
    ? stats.endgame_l3_rate > 0
      ? "L3"
      : stats.endgame_l2_rate > 0
        ? "L2"
        : stats.endgame_l1_rate > 0
          ? "L1"
          : "None"
    : null;

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
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Autonomous
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Fuel</span>
                  <span className="font-medium">{stats.auto_fuel_scored}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Climb Rate</span>
                  <Badge
                    variant={
                      stats.auto_climb_rate > 50 ? "default" : "secondary"
                    }
                    className="text-xs h-5"
                  >
                    {stats.auto_climb_rate}%
                  </Badge>
                </div>
                {stats.auto_fuel_missed > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Missed</span>
                    <span className="font-medium">
                      {stats.auto_fuel_missed}
                    </span>
                  </div>
                )}
                {stats.auto_fuel_shuttled > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shuttled</span>
                    <span className="font-medium">
                      {stats.auto_fuel_shuttled}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-1" />

            {/* Teleop Summary */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Flame className="h-3 w-3" /> Teleop
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fuel Scored</span>
                  <span className="font-medium">
                    {stats.teleop_fuel_scored}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accuracy</span>
                  <Badge
                    variant={
                      stats.teleop_fuel_accuracy > 60 ? "default" : "secondary"
                    }
                    className="text-xs h-5"
                  >
                    {stats.teleop_fuel_accuracy}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Passed</span>
                  <span className="font-medium">
                    {stats.teleop_fuel_passed}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Corraled</span>
                  <span className="font-medium">
                    {stats.teleop_fuel_corraled}
                  </span>
                </div>
                {stats.teleop_fuel_shuttled > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shuttled</span>
                    <span className="font-medium">
                      {stats.teleop_fuel_shuttled}
                    </span>
                  </div>
                )}
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
                  <span className="text-muted-foreground">Best Climb</span>
                  <Badge
                    variant={
                      bestClimb === "L3"
                        ? "default"
                        : bestClimb === "L2"
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs h-5"
                  >
                    {bestClimb}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L3 Rate</span>
                  <span className="font-medium">{stats.endgame_l3_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L2 Rate</span>
                  <span className="font-medium">{stats.endgame_l2_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L1 Rate</span>
                  <span className="font-medium">{stats.endgame_l1_rate}%</span>
                </div>
              </div>
            </div>

            {/* Reliability Warning */}
            {(stats.endgame_breakdown_rate > 15 ||
              stats.avg_tech_fouls > 0.5) && (
              <>
                <Separator className="my-1" />
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div className="flex flex-wrap gap-2">
                    {stats.endgame_breakdown_rate > 15 && (
                      <Badge variant="destructive" className="text-xs">
                        {stats.endgame_breakdown_rate}% breakdown
                      </Badge>
                    )}
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

            {/* Playstyle */}
            {(stats.playstyle_defensive_rate > 0 ||
              stats.playstyle_offensive_rate > 0) && (
              <>
                <Separator className="my-1" />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Playstyle
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {stats.playstyle_offensive_rate > 0 && (
                      <Badge variant="default" className="text-xs">
                        Offensive {stats.playstyle_offensive_rate}%
                      </Badge>
                    )}
                    {stats.playstyle_balanced_rate > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Balanced {stats.playstyle_balanced_rate}%
                      </Badge>
                    )}
                    {stats.playstyle_defensive_rate > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Defensive {stats.playstyle_defensive_rate}%
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
                            Intake:{" "}
                            {Array.isArray(teleopPit.intakeType)
                              ? (teleopPit.intakeType as string[]).join(", ")
                              : String(teleopPit.intakeType)}
                          </Badge>
                        )}
                        {teleopPit?.cycleTime != null && (
                          <Badge variant="outline" className="text-xs">
                            Cycle: {String(teleopPit.cycleTime)}s
                          </Badge>
                        )}
                        {!!teleopPit?.humanPlayerAccuracy && (
                          <Badge variant="outline" className="text-xs">
                            HP Acc: {String(teleopPit.humanPlayerAccuracy)}
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

export default FRCMatchupCard2026;
