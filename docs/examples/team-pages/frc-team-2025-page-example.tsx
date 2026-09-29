"use client";

// Legacy hard-coded example preserved from the parent of f4badd2.

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Trophy,
  Target,
  Activity,
  BarChart,
  Wrench,
} from "lucide-react";
import TeamInfo from "@/components/team-pages-common/TeamInfo";
import TeamImage from "@/components/team-pages-common/TeamImage";
import TeamNotes from "@/components/team-pages-common/TeamNotes";
import { PerformanceOverTimeChart } from "@/components/charts/performance-over-time-chart";
import { useTeamData } from "@/hooks/use-team-data";
import { useGameConfig } from "@/hooks/use-game-config";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Team2025PageProps {
  teamNumber: string;
}

// REEFSCAPE 2025 specific data structure
interface ReefscapeData {
  avg_total: number;
  epa: number;
  avg_auto_coral: number;
  avg_auto_algae: number;
  avg_teleop_coral: number;
  avg_teleop_algae: number;

  // Auto leave rate
  auto_leave_rate: number;

  // Detailed autonomous breakdown
  auto_trough: number;
  auto_l2: number;
  auto_l3: number;
  auto_l4: number;
  auto_net: number;
  auto_processor: number;

  // Detailed teleop breakdown
  teleop_trough: number;
  teleop_l2: number;
  teleop_l3: number;
  teleop_l4: number;
  teleop_net: number;
  teleop_processor: number;

  // Endgame distribution
  endgame_none_rate: number;
  endgame_park_rate: number;
  endgame_shallow_rate: number;
  endgame_deep_rate: number;

  // Fouls
  avg_fouls: number;
  avg_tech_fouls: number;
}

export function FRCTeam2025Page({ teamNumber }: Team2025PageProps) {
  const [searchNote, setSearchNote] = useState("");
  const { teamData, loading, error } = useTeamData(teamNumber);
  const { currentYear, getCurrentYearConfig } = useGameConfig();
  const yearConfig = getCurrentYearConfig();
  const [averageScore, setAverageScore] = useState<number>(0);
  const [loadingAvgScore, setLoadingAvgScore] = useState(false);

  // Fetch average score from The Blue Alliance
  useEffect(() => {
    async function fetchAverageScore() {
      if (!teamData?.year || !teamData?.eventCode) return;

      setLoadingAvgScore(true);
      try {
        const response = await fetch(
          `/api/teams/${teamNumber}/average-score?year=${teamData.year}&eventCode=${teamData.eventCode}&competitionType=FRC`,
        );

        if (response.ok) {
          const data = await response.json();
          setAverageScore(data.averageScore || 0);
        }
      } catch (error) {
        console.error("Error fetching average score from TBA:", error);
      } finally {
        setLoadingAvgScore(false);
      }
    }

    fetchAverageScore();
  }, [teamNumber, teamData?.year, teamData?.eventCode]);

  // Calculate REEFSCAPE specific statistics using the SQL data
  const calculateReefscapeStats = (): ReefscapeData | null => {
    if (!teamData?.matchEntries || teamData.matchEntries.length === 0)
      return null;

    const matchEntries = teamData.matchEntries;
    const count = matchEntries.length;

    const totals = matchEntries.reduce(
      (acc, match) => {
        const auto =
          (match.gameSpecificData?.autonomous as
            | Record<string, number | boolean>
            | undefined) || {};
        const teleop =
          (match.gameSpecificData?.teleop as
            | Record<string, number>
            | undefined) || {};
        const endgame =
          (match.gameSpecificData?.endgame as
            | Record<string, string>
            | undefined) || {};
        const fouls =
          (match.gameSpecificData?.fouls as
            | Record<string, number>
            | undefined) || {};

        return {
          auto_leave: acc.auto_leave + (auto.leave ? 1 : 0),
          auto_l1: acc.auto_l1 + (Number(auto.L1_coral) || 0),
          auto_l2: acc.auto_l2 + (Number(auto.L2_coral) || 0),
          auto_l3: acc.auto_l3 + (Number(auto.L3_coral) || 0),
          auto_l4: acc.auto_l4 + (Number(auto.L4_coral) || 0),
          auto_net: acc.auto_net + (Number(auto.net_algae) || 0),
          auto_processor:
            acc.auto_processor + (Number(auto.processor_algae) || 0),

          teleop_l1: acc.teleop_l1 + (teleop.L1_coral || 0),
          teleop_l2: acc.teleop_l2 + (teleop.L2_coral || 0),
          teleop_l3: acc.teleop_l3 + (teleop.L3_coral || 0),
          teleop_l4: acc.teleop_l4 + (teleop.L4_coral || 0),
          teleop_net: acc.teleop_net + (teleop.net_algae || 0),
          teleop_processor:
            acc.teleop_processor + (teleop.processor_algae || 0),

          endgame_none:
            acc.endgame_none +
            (!endgame.ending_robot_state ||
            endgame.ending_robot_state === "none"
              ? 1
              : 0),
          endgame_park:
            acc.endgame_park + (endgame.ending_robot_state === "park" ? 1 : 0),
          endgame_shallow:
            acc.endgame_shallow +
            (endgame.ending_robot_state === "shallow" ? 1 : 0),
          endgame_deep:
            acc.endgame_deep + (endgame.ending_robot_state === "deep" ? 1 : 0),

          fouls: acc.fouls + (fouls.fouls || 0),
          tech_fouls: acc.tech_fouls + (fouls.tech_fouls || 0),
        };
      },
      {
        auto_leave: 0,
        auto_l1: 0,
        auto_l2: 0,
        auto_l3: 0,
        auto_l4: 0,
        auto_net: 0,
        auto_processor: 0,
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

    return {
      avg_total: averageScore,
      epa: teamData.epa?.totalEPA || 0,
      auto_leave_rate: parseFloat(
        ((totals.auto_leave / count) * 100).toFixed(1),
      ),
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

  const reefscapeData = calculateReefscapeStats();

  // Chart data for teleop breakdown
  const teleopBreakdownData = reefscapeData
    ? [
        { name: "Trough", value: reefscapeData.teleop_trough },
        { name: "L2", value: reefscapeData.teleop_l2 },
        { name: "L3", value: reefscapeData.teleop_l3 },
        { name: "L4", value: reefscapeData.teleop_l4 },
        { name: "Net", value: reefscapeData.teleop_net },
        { name: "Processor", value: reefscapeData.teleop_processor },
      ]
    : [];

  // Extract actual notes from team data
  const extractTeamNotes = (): string[] => {
    const notes: string[] = [];

    // Add notes from match entries
    if (teamData?.matchEntries) {
      teamData.matchEntries.forEach((match) => {
        if (match.notes && match.notes.trim()) {
          notes.push(match.notes.trim());
        }
      });
    }

    // Add notes from pit entry if available
    if (teamData?.pitEntry) {
      // Check if there are notes in gameSpecificData
      const pitData = teamData.pitEntry.gameSpecificData;
      if (pitData && typeof pitData === "object") {
        // Look for notes fields in game-specific data
        Object.entries(pitData).forEach(([key, value]) => {
          if (
            key.toLowerCase().includes("note") &&
            typeof value === "string" &&
            value.trim()
          ) {
            notes.push(value.trim());
          }
        });
      }
    }

    // Remove duplicates and return
    return [...new Set(notes)];
  };

  const teamNotes = extractTeamNotes();
  const filteredNotes = teamNotes.filter((note) =>
    note.toLowerCase().includes(searchNote.toLowerCase()),
  );

  // Chart configuration for teleop breakdown
  const teleopChartConfig = {
    value: {
      label: "Avg Coral",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team {teamNumber}</h1>
        <Badge variant="outline" className="text-lg px-3 py-1 mb-6">
          2025 - REEFSCAPE
        </Badge>
        <p className="text-muted-foreground">Loading team data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team {teamNumber}</h1>
        <Badge variant="outline" className="text-lg px-3 py-1 mb-6">
          2025 - REEFSCAPE
        </Badge>
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }
  // console.log("Team Data:", teamData);
  if (!teamData?.matchEntries || teamData.matchEntries.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team {teamNumber}</h1>
        <Badge variant="outline" className="text-lg px-3 py-1 mb-6">
          2025 - REEFSCAPE
        </Badge>
        <p className="text-muted-foreground">
          No data available for Team {teamNumber} in 2025.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-2">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-muted-foreground">
            2025 REEFSCAPE performance analysis and scouting data
          </p>
        </div>
      </div>

      {/* Robot Image and Basic Info */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <TeamImage teamNumber={teamNumber} yearLabel="2025 REEFSCAPE" />
        </div>

        <div className="space-y-4">
          <TeamInfo
            teamNumber={teamNumber}
            driveTrain={teamData?.pitEntry?.driveTrain}
            weight={teamData?.pitEntry?.weight}
            matches={teamData?.matchCount}
          />

          <Button className="w-full" variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit Team Website
          </Button>
        </div>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reefscapeData
                ? (isNaN(reefscapeData.avg_total)
                    ? 0
                    : reefscapeData.avg_total
                  ).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total points per match
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EPA Rating</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reefscapeData
                ? (isNaN(reefscapeData.epa) ? 0 : reefscapeData.epa).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Expected points added
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto Coral</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reefscapeData
                ? (isNaN(reefscapeData.avg_auto_coral)
                    ? 0
                    : reefscapeData.avg_auto_coral
                  ).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Average autonomous coral
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Leave rate: {reefscapeData?.auto_leave_rate ?? 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teleop Coral</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reefscapeData?.avg_teleop_coral.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Average teleop coral
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Autonomous Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Autonomous Performance</CardTitle>
            <CardDescription>
              Detailed breakdown of autonomous period scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">L2</span>
                  <span className="font-medium">
                    {reefscapeData?.auto_l2.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">L3</span>
                  <span className="font-medium">
                    {reefscapeData?.auto_l3.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">L4</span>
                  <span className="font-medium">
                    {reefscapeData?.auto_l4.toFixed(1) || 0}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Net</span>
                  <span className="font-medium">
                    {reefscapeData?.auto_net.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Processor</span>
                  <span className="font-medium">
                    {reefscapeData?.auto_processor.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Trough</span>
                  <span className="font-medium">
                    {reefscapeData?.auto_trough.toFixed(1) || 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teleop Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Teleop Performance</CardTitle>
            <CardDescription>
              Detailed breakdown of teleop period scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">L2</span>
                  <span className="font-medium">
                    {reefscapeData?.teleop_l2.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">L3</span>
                  <span className="font-medium">
                    {reefscapeData?.teleop_l3.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">L4</span>
                  <span className="font-medium">
                    {reefscapeData?.teleop_l4.toFixed(1) || 0}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Net</span>
                  <span className="font-medium">
                    {reefscapeData?.teleop_net.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Processor</span>
                  <span className="font-medium">
                    {reefscapeData?.teleop_processor.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Trough</span>
                  <span className="font-medium">
                    {reefscapeData?.teleop_trough.toFixed(1) || 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Teleop Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Teleop Scoring Breakdown</CardTitle>
            <CardDescription>
              Average points by scoring location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={teleopChartConfig}>
              <RechartsBarChart
                data={teleopBreakdownData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Bar dataKey="value" fill="var(--color-value)" radius={8} />
              </RechartsBarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Performance Over Time */}
        {yearConfig &&
        teamData?.matchEntries &&
        teamData.matchEntries.length > 1 ? (
          <PerformanceOverTimeChart
            matchEntries={teamData.matchEntries}
            yearConfig={yearConfig}
            year={currentYear}
          />
        ) : (
          <Card className="flex items-center justify-center">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">
                Need 2+ matches for performance trend
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Endgame & Reliability */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Endgame Climb Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Endgame Climb Distribution</CardTitle>
            <CardDescription>
              Percentage of matches at each endgame state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <h4 className="font-semibold mb-2">None</h4>
                <Badge variant="secondary">
                  {reefscapeData?.endgame_none_rate.toFixed(1) || 0}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">0 pts</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Park</h4>
                <Badge variant="secondary">
                  {reefscapeData?.endgame_park_rate.toFixed(1) || 0}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">3 pts</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Shallow Cage</h4>
                <Badge variant="secondary">
                  {reefscapeData?.endgame_shallow_rate.toFixed(1) || 0}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">6 pts</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Deep Cage</h4>
                <Badge
                  variant={
                    reefscapeData && reefscapeData.endgame_deep_rate > 50
                      ? "default"
                      : "secondary"
                  }
                >
                  {reefscapeData?.endgame_deep_rate.toFixed(1) || 0}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">12 pts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reliability & Fouls */}
        <Card>
          <CardHeader>
            <CardTitle>Reliability & Penalties</CardTitle>
            <CardDescription>Penalty averages per match</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Fouls per Match</span>
                <Badge variant="secondary">
                  {reefscapeData?.avg_fouls.toFixed(1) || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Tech Fouls per Match</span>
                <Badge
                  variant={
                    reefscapeData && reefscapeData.avg_tech_fouls > 0.5
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {reefscapeData?.avg_tech_fouls.toFixed(1) || 0}
                </Badge>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-sm">Est. Penalty Points</span>
                  <Badge variant="secondary">
                    {reefscapeData
                      ? (
                          reefscapeData.avg_fouls * -2 +
                          reefscapeData.avg_tech_fouls * -5
                        ).toFixed(1)
                      : 0}{" "}
                    pts
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pit Scouting Report */}
      {teamData?.pitEntry?.gameSpecificData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Pit Scouting Report
            </CardTitle>
            <CardDescription>
              Robot capabilities reported during pit scouting
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const gsd = teamData.pitEntry.gameSpecificData as Record<
                string,
                string | number | boolean | string[]
              >;
              return (
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Autonomous Capabilities */}
                  <div>
                    <h4 className="font-semibold mb-3">Autonomous</h4>
                    <div className="space-y-2">
                      {gsd.autonomous_startingPosition && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Starting Position
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.autonomous_startingPosition)}
                          </Badge>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Leaves Zone
                        </span>
                        <Badge
                          variant={
                            gsd.autonomous_autoLeave ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {gsd.autonomous_autoLeave ? "Yes" : "No"}
                        </Badge>
                      </div>
                      {gsd.autonomous_autoCoralLevels && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Coral Levels
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.autonomous_autoCoralLevels)}
                          </Badge>
                        </div>
                      )}
                      {gsd.autonomous_autoAlgaeScoring && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Algae Scoring
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.autonomous_autoAlgaeScoring)}
                          </Badge>
                        </div>
                      )}
                      {gsd.autonomous_autoRoutineCount != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Auto Routines
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {String(gsd.autonomous_autoRoutineCount)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Teleop Capabilities */}
                  <div>
                    <h4 className="font-semibold mb-3">Teleoperated</h4>
                    <div className="space-y-2">
                      {gsd.teleoperated_intakeType && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Intake Method
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.teleoperated_intakeType)}
                          </Badge>
                        </div>
                      )}
                      {gsd.teleoperated_coralCapability && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Coral Capability
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.teleoperated_coralCapability)}
                          </Badge>
                        </div>
                      )}
                      {gsd.teleoperated_algaeCapability && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Algae Capability
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.teleoperated_algaeCapability)}
                          </Badge>
                        </div>
                      )}
                      {gsd.teleoperated_cycleTime != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Cycle Time
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {String(gsd.teleoperated_cycleTime)}s
                          </Badge>
                        </div>
                      )}
                      {gsd.teleoperated_reliability && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Reliability
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.teleoperated_reliability)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Endgame Capabilities */}
                  <div>
                    <h4 className="font-semibold mb-3">Endgame</h4>
                    <div className="space-y-2">
                      {gsd.endgame_climbCapability && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Climb Capability
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.endgame_climbCapability)}
                          </Badge>
                        </div>
                      )}
                      {gsd.endgame_climbTime != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Climb Time
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {String(gsd.endgame_climbTime)}s
                          </Badge>
                        </div>
                      )}
                      {gsd.endgame_climbReliability && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Climb Reliability
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {String(gsd.endgame_climbReliability)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Scouting Notes */}
      <TeamNotes
        notes={teamNotes}
        searchNote={searchNote}
        setSearchNote={setSearchNote}
      />
    </div>
  );
}
