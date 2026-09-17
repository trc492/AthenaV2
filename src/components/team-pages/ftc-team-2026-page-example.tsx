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
  Cell,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface TeamPageProps {
  teamNumber: string;
}

// DECODE 2026 specific data structure
interface DecodeData {
  avg_total: number;
  epa: number;
  avg_auto_artifacts: number;
  avg_auto_patterns: number;
  avg_teleop_artifacts: number;
  avg_teleop_patterns: number;

  // Auto leave rate
  auto_leave_rate: number;

  // Detailed autonomous breakdown
  auto_artifacts_classified: number;
  auto_artifacts_overflow: number;
  auto_patterns: number;

  // Detailed teleop breakdown
  teleop_artifacts_classified: number;
  teleop_artifacts_overflow: number;
  teleop_artifacts_depot: number;
  teleop_patterns: number;

  // Endgame distribution
  endgame_none_rate: number;
  endgame_partial_rate: number;
  endgame_full_rate: number;

  // Penalties
  avg_minor_penalties: number;
  avg_major_penalties: number;
}

export function FTCTeam2026Page({ teamNumber }: TeamPageProps) {
  const [searchNote, setSearchNote] = useState("");
  const { teamData, loading, error } = useTeamData(teamNumber);
  const { currentYear, getCurrentYearConfig } = useGameConfig();
  const yearConfig = getCurrentYearConfig();
  const [averageScore, setAverageScore] = useState<number>(0);
  const [loadingAvgScore, setLoadingAvgScore] = useState(false);

  // Fetch average score from FIRST Events API
  useEffect(() => {
    async function fetchAverageScore() {
      if (!teamData?.year || !teamData?.eventCode) return;

      setLoadingAvgScore(true);
      try {
        const response = await fetch(
          `/api/teams/${teamNumber}/average-score?year=${teamData.year}&eventCode=${teamData.eventCode}&competitionType=FTC`,
        );

        if (response.ok) {
          const data = await response.json();
          setAverageScore(data.averageScore || 0);
        }
      } catch (error) {
        console.error(
          "Error fetching average score from FIRST Events API:",
          error,
        );
      } finally {
        setLoadingAvgScore(false);
      }
    }

    fetchAverageScore();
  }, [teamNumber, teamData?.year, teamData?.eventCode]);

  // Calculate DECODE specific statistics using the SQL data
  const calculateDecodeStats = (): DecodeData | null => {
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
          auto_artifacts_classified:
            acc.auto_artifacts_classified +
            (Number(auto.artifacts_classified) || 0),
          auto_artifacts_overflow:
            acc.auto_artifacts_overflow +
            (Number(auto.artifacts_overflow) || 0),
          auto_patterns: acc.auto_patterns + (Number(auto.patterns) || 0),

          teleop_artifacts_classified:
            acc.teleop_artifacts_classified +
            (teleop.artifacts_classified || 0),
          teleop_artifacts_overflow:
            acc.teleop_artifacts_overflow + (teleop.artifacts_overflow || 0),
          teleop_artifacts_depot:
            acc.teleop_artifacts_depot + (teleop.artifacts_depot || 0),
          teleop_patterns: acc.teleop_patterns + (teleop.patterns || 0),

          endgame_none:
            acc.endgame_none +
            (!endgame.ending_based_state ||
            endgame.ending_based_state === "none"
              ? 1
              : 0),
          endgame_partial:
            acc.endgame_partial +
            (endgame.ending_based_state === "partial" ? 1 : 0),
          endgame_full:
            acc.endgame_full + (endgame.ending_based_state === "full" ? 1 : 0),

          minor_penalties: acc.minor_penalties + (fouls.minor_penalties || 0),
          major_penalties: acc.major_penalties + (fouls.major_penalties || 0),
        };
      },
      {
        auto_leave: 0,
        auto_artifacts_classified: 0,
        auto_artifacts_overflow: 0,
        auto_patterns: 0,
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

    // Calculate averages and points
    const autoArtifactsClassified = parseFloat(
      (totals.auto_artifacts_classified / count).toFixed(1),
    );
    const autoArtifactsOverflow = parseFloat(
      (totals.auto_artifacts_overflow / count).toFixed(1),
    );
    const autoPatterns = parseFloat((totals.auto_patterns / count).toFixed(1));

    const teleopArtifactsClassified = parseFloat(
      (totals.teleop_artifacts_classified / count).toFixed(1),
    );
    const teleopArtifactsOverflow = parseFloat(
      (totals.teleop_artifacts_overflow / count).toFixed(1),
    );
    const teleopArtifactsDepot = parseFloat(
      (totals.teleop_artifacts_depot / count).toFixed(1),
    );
    const teleopPatterns = parseFloat(
      (totals.teleop_patterns / count).toFixed(1),
    );

    return {
      avg_total: averageScore,
      epa: teamData.epa?.totalEPA || 0,
      auto_leave_rate: parseFloat(
        ((totals.auto_leave / count) * 100).toFixed(1),
      ),
      avg_auto_artifacts: autoArtifactsClassified + autoArtifactsOverflow,
      avg_auto_patterns: autoPatterns,
      avg_teleop_artifacts:
        teleopArtifactsClassified +
        teleopArtifactsOverflow +
        teleopArtifactsDepot,
      avg_teleop_patterns: teleopPatterns,

      auto_artifacts_classified: autoArtifactsClassified,
      auto_artifacts_overflow: autoArtifactsOverflow,
      auto_patterns: autoPatterns,

      teleop_artifacts_classified: teleopArtifactsClassified,
      teleop_artifacts_overflow: teleopArtifactsOverflow,
      teleop_artifacts_depot: teleopArtifactsDepot,
      teleop_patterns: teleopPatterns,

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

  const decodeData = calculateDecodeStats();

  // Chart data for artifact scoring breakdown
  const artifactBreakdownData = decodeData
    ? [
        {
          name: "Auto Classified",
          value: decodeData.auto_artifacts_classified,
          fill: "#8b5cf6",
        },
        {
          name: "Auto Overflow",
          value: decodeData.auto_artifacts_overflow,
          fill: "#a78bfa",
        },
        {
          name: "Teleop Classified",
          value: decodeData.teleop_artifacts_classified,
          fill: "#3b82f6",
        },
        {
          name: "Teleop Overflow",
          value: decodeData.teleop_artifacts_overflow,
          fill: "#60a5fa",
        },
        {
          name: "Teleop Depot",
          value: decodeData.teleop_artifacts_depot,
          fill: "#93c5fd",
        },
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
      const pitData = teamData.pitEntry.gameSpecificData;
      if (pitData && typeof pitData === "object") {
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

  // Chart configuration for artifact breakdown
  const artifactChartConfig = {
    value: {
      label: "Avg Artifacts",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team {teamNumber}</h1>
        <Badge variant="outline" className="text-lg px-3 py-1 mb-6">
          2026 - DECODE
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
          2026 - DECODE
        </Badge>
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (!teamData?.matchEntries || teamData.matchEntries.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team {teamNumber}</h1>
        <Badge variant="outline" className="text-lg px-3 py-1 mb-6">
          2026 - DECODE
        </Badge>
        <p className="text-muted-foreground">
          No data available for Team {teamNumber} in 2026.
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
            2026 DECODE performance analysis and scouting data
          </p>
        </div>
      </div>

      {/* Basic Info - No Robot Image for FTC */}
      <div className="grid gap-6">
        <TeamInfo
          teamNumber={teamNumber}
          driveTrain={teamData?.pitEntry?.driveTrain}
          weight={teamData?.pitEntry?.weight}
          matches={teamData?.matchCount}
        />

        <Button className="w-full md:w-auto" variant="outline">
          <ExternalLink className="mr-2 h-4 w-4" />
          Visit Team Website
        </Button>
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
              {decodeData
                ? (isNaN(decodeData.avg_total)
                    ? 0
                    : decodeData.avg_total
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
              {decodeData
                ? (isNaN(decodeData.epa) ? 0 : decodeData.epa).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Expected points added
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Auto Artifacts
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {decodeData
                ? (isNaN(decodeData.avg_auto_artifacts)
                    ? 0
                    : decodeData.avg_auto_artifacts
                  ).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Average autonomous artifacts
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Leave rate: {decodeData?.auto_leave_rate ?? 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Teleop Artifacts
            </CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {decodeData?.avg_teleop_artifacts.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Average teleop artifacts
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
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Artifacts Classified</span>
                <span className="font-medium">
                  {decodeData?.auto_artifacts_classified.toFixed(1) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Artifacts Overflow</span>
                <span className="font-medium">
                  {decodeData?.auto_artifacts_overflow.toFixed(1) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Patterns Completed</span>
                <span className="font-medium">
                  {decodeData?.auto_patterns.toFixed(1) || 0}
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-sm">Total Auto Points</span>
                  <span>
                    {decodeData
                      ? (
                          decodeData.auto_artifacts_classified * 3 +
                          decodeData.auto_artifacts_overflow * 1 +
                          decodeData.auto_patterns * 6
                        ).toFixed(1)
                      : 0}
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
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Artifacts Classified</span>
                <span className="font-medium">
                  {decodeData?.teleop_artifacts_classified.toFixed(1) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Artifacts Overflow</span>
                <span className="font-medium">
                  {decodeData?.teleop_artifacts_overflow.toFixed(1) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Artifacts in Depot</span>
                <span className="font-medium">
                  {decodeData?.teleop_artifacts_depot.toFixed(1) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Patterns Completed</span>
                <span className="font-medium">
                  {decodeData?.teleop_patterns.toFixed(1) || 0}
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-sm">Total Teleop Points</span>
                  <span>
                    {decodeData
                      ? (
                          decodeData.teleop_artifacts_classified * 3 +
                          decodeData.teleop_artifacts_overflow * 1 +
                          decodeData.teleop_artifacts_depot * 1 +
                          decodeData.teleop_patterns * 6
                        ).toFixed(1)
                      : 0}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Artifact Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Artifact Scoring Breakdown</CardTitle>
            <CardDescription>
              Average artifacts by scoring method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={artifactChartConfig}>
              <RechartsBarChart
                data={artifactBreakdownData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Bar dataKey="value" radius={8}>
                  {artifactBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
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
        {/* Endgame Base State Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Endgame Base Distribution</CardTitle>
            <CardDescription>
              Percentage of matches at each base state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold mb-2">None</h4>
                <Badge variant="secondary">
                  {decodeData?.endgame_none_rate.toFixed(1) || 0}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">0 pts</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Partial Base</h4>
                <Badge variant="secondary">
                  {decodeData?.endgame_partial_rate.toFixed(1) || 0}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">5 pts</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Full Base</h4>
                <Badge
                  variant={
                    decodeData && decodeData.endgame_full_rate > 50
                      ? "default"
                      : "secondary"
                  }
                >
                  {decodeData?.endgame_full_rate.toFixed(1) || 0}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">10 pts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Penalties */}
        <Card>
          <CardHeader>
            <CardTitle>Penalties</CardTitle>
            <CardDescription>Penalty averages per match</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Minor Penalties</span>
                <Badge variant="secondary">
                  {decodeData?.avg_minor_penalties.toFixed(1) || 0}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Major Penalties</span>
                <Badge
                  variant={
                    decodeData && decodeData.avg_major_penalties > 0.3
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {decodeData?.avg_major_penalties.toFixed(1) || 0}
                </Badge>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-sm">Est. Penalty Points</span>
                  <Badge variant="secondary">
                    {decodeData
                      ? (
                          decodeData.avg_minor_penalties * -5 +
                          decodeData.avg_major_penalties * -15
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

      {/* Pattern Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Pattern Completion Performance</CardTitle>
          <CardDescription>Patterns completed during matches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Autonomous Patterns</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Average per Match</span>
                  <Badge variant="secondary">
                    {decodeData?.auto_patterns.toFixed(1) || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Points Contribution</span>
                  <Badge variant="secondary">
                    {decodeData ? (decodeData.auto_patterns * 6).toFixed(1) : 0}{" "}
                    pts
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Teleop Patterns</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Average per Match</span>
                  <Badge variant="secondary">
                    {decodeData?.teleop_patterns.toFixed(1) || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Points Contribution</span>
                  <Badge variant="secondary">
                    {decodeData
                      ? (decodeData.teleop_patterns * 6).toFixed(1)
                      : 0}{" "}
                    pts
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <div className="grid md:grid-cols-3 gap-6">
              {/* Autonomous Capabilities */}
              <div>
                <h4 className="font-semibold mb-3">Autonomous</h4>
                <div className="space-y-2">
                  {!!(
                    teamData.pitEntry.gameSpecificData as Record<
                      string,
                      unknown
                    >
                  ).autonomous &&
                    (() => {
                      const autoData = (
                        teamData.pitEntry.gameSpecificData as Record<
                          string,
                          Record<string, unknown>
                        >
                      ).autonomous;
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Leaves Zone
                            </span>
                            <Badge
                              variant={
                                autoData.autoLeave ? "default" : "secondary"
                              }
                              className="text-xs"
                            >
                              {autoData.autoLeave ? "Yes" : "No"}
                            </Badge>
                          </div>
                          {autoData.autoArtifactsClassified != null && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Artifacts Classified
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {String(autoData.autoArtifactsClassified)}
                              </Badge>
                            </div>
                          )}
                          {autoData.autoPatterns != null && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Auto Patterns
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {String(autoData.autoPatterns)}
                              </Badge>
                            </div>
                          )}
                          {autoData.autoRoutineCount != null && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Auto Routines
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {String(autoData.autoRoutineCount)}
                              </Badge>
                            </div>
                          )}
                        </>
                      );
                    })()}
                </div>
              </div>

              {/* Teleop Capabilities */}
              <div>
                <h4 className="font-semibold mb-3">Teleoperated</h4>
                <div className="space-y-2">
                  {!!(
                    teamData.pitEntry.gameSpecificData as Record<
                      string,
                      unknown
                    >
                  ).teleoperated &&
                    (() => {
                      const teleopData = (
                        teamData.pitEntry.gameSpecificData as Record<
                          string,
                          Record<string, unknown>
                        >
                      ).teleoperated;
                      return (
                        <>
                          {teleopData.artifactIntake && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Intake Method
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {String(teleopData.artifactIntake)}
                              </Badge>
                            </div>
                          )}
                          {teleopData.shootingReliability && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Shooting Reliability
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {String(teleopData.shootingReliability)}
                              </Badge>
                            </div>
                          )}
                          {teleopData.shootingLocations && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Shooting Locations
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {String(teleopData.shootingLocations)}
                              </Badge>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Can Sort
                            </span>
                            <Badge
                              variant={
                                teleopData.canSort ? "default" : "secondary"
                              }
                              className="text-xs"
                            >
                              {teleopData.canSort ? "Yes" : "No"}
                            </Badge>
                          </div>
                          {teleopData.cycleTime != null && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Cycle Time
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {String(teleopData.cycleTime)}s
                              </Badge>
                            </div>
                          )}
                        </>
                      );
                    })()}
                </div>
              </div>

              {/* Endgame Capabilities */}
              <div>
                <h4 className="font-semibold mb-3">Endgame</h4>
                <div className="space-y-2">
                  {!!(
                    teamData.pitEntry.gameSpecificData as Record<
                      string,
                      unknown
                    >
                  ).endgame &&
                    (() => {
                      const endData = (
                        teamData.pitEntry.gameSpecificData as Record<
                          string,
                          Record<string, unknown>
                        >
                      ).endgame;
                      return (
                        <>
                          {endData.baseCapability && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Base Capability
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {String(endData.baseCapability)}
                              </Badge>
                            </div>
                          )}
                        </>
                      );
                    })()}
                </div>
              </div>
            </div>
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
