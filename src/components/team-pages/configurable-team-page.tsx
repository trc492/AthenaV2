"use client";

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
  BarChart as BarChartIcon,
  Flame,
  Package,
  Puzzle,
  AlertTriangle,
  Wrench,
  Map,
  Ruler,
  Sparkles,
} from "lucide-react";
import TeamInfo from "@/components/team-pages-common/TeamInfo";
import TeamImage from "@/components/team-pages-common/TeamImage";
import TeamNotes from "@/components/team-pages-common/TeamNotes";
import { FieldDrawingCanvas } from "@/components/forms/field-drawing-canvas";
import { PerformanceOverTimeChart } from "@/components/charts/performance-over-time-chart";
import { useTeamData } from "@/hooks/use-team-data";
import { useGameConfig } from "@/hooks/use-game-config";
import { calculateDetailedGameStats, extractScoutingNotes } from "@/lib/statistics";
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

export interface TeamPageProps {
  teamNumber: string;
}

function renderDynamicIcon(iconName?: string) {
  const className = "h-4 w-4 text-muted-foreground";
  switch (iconName?.toLowerCase()) {
    case "activity":
      return <Activity className={className} />;
    case "target":
      return <Target className={className} />;
    case "trophy":
      return <Trophy className={className} />;
    case "flame":
      return <Flame className={className} />;
    case "package":
      return <Package className={className} />;
    case "puzzle":
      return <Puzzle className={className} />;
    case "barchart":
      return <BarChartIcon className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export function ConfigurableTeamPage({ teamNumber }: TeamPageProps) {
  const [searchNote, setSearchNote] = useState("");
  const { teamData, loading, error } = useTeamData(teamNumber);
  const { currentYear, competitionType, getCurrentYearConfig } = useGameConfig();
  const yearConfig = getCurrentYearConfig();
  const [averageScore, setAverageScore] = useState<number>(0);

  // Fetch average score from TBA or FIRST Events API
  useEffect(() => {
    async function fetchAverageScore() {
      if (!teamData?.year || !teamData?.eventCode) return;

      try {
        const response = await fetch(
          `/api/teams/${teamNumber}/average-score?year=${teamData.year}&eventCode=${teamData.eventCode}&competitionType=${competitionType}`,
        );

        if (response.ok) {
          const data = await response.json();
          setAverageScore(data.averageScore || 0);
        }
      } catch (err) {
        console.error("Error fetching average score:", err);
      }
    }

    fetchAverageScore();
  }, [teamNumber, teamData?.year, teamData?.eventCode, competitionType]);

  const stats = yearConfig
    ? calculateDetailedGameStats(teamData?.matchEntries, yearConfig, teamData)
    : null;

  const teamNotes = extractScoutingNotes(teamData);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team {teamNumber}</h1>
        <Badge variant="outline" className="text-lg px-3 py-1 mb-6">
          {currentYear} - {yearConfig?.gameName || ""}
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
          {currentYear} - {yearConfig?.gameName || ""}
        </Badge>
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  if (!teamData?.matchEntries || teamData.matchEntries.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Team {teamNumber}</h1>
        <Badge variant="outline" className="text-lg px-3 py-1 mb-6">
          {currentYear} - {yearConfig?.gameName || ""}
        </Badge>
        <p className="text-muted-foreground">
          No data available for Team {teamNumber} in {currentYear}.
        </p>
      </div>
    );
  }

  const pageConfig = yearConfig?.teamPageConfig;

  // Chart configuration for breakdown
  const scoringBreakdownConfig = pageConfig?.scoringBreakdownChart;
  const breakdownChartData = stats && scoringBreakdownConfig
    ? scoringBreakdownConfig.items.map((item) => ({
        name: item.name,
        value: stats.getMetricValue(item.key),
        fill: item.fill || "var(--chart-1)",
      }))
    : [];

  const chartThemeConfig = {
    value: {
      label: scoringBreakdownConfig?.title || "Score",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  // Auto / Teleop KPI calculations
  const autoKpiVal = stats
    ? pageConfig?.kpis?.auto?.key
      ? stats.getMetricValue(pageConfig.kpis.auto.key)
      : stats.getMetricValue("calculated.auto_coral") ||
        stats.getMetricValue("autonomous.fuel_scored") ||
        stats.getMetricValue("calculated.auto_artifacts")
    : 0;

  const autoKpiSubVal = stats && pageConfig?.kpis?.auto?.subKey
    ? stats.getMetricValue(pageConfig.kpis.auto.subKey)
    : null;

  const teleopKpiVal = stats
    ? pageConfig?.kpis?.teleop?.key
      ? stats.getMetricValue(pageConfig.kpis.teleop.key)
      : stats.getMetricValue("calculated.teleop_coral") ||
        stats.getMetricValue("teleop.fuel_scored") ||
        stats.getMetricValue("calculated.teleop_artifacts")
    : 0;

  const teleopKpiSubVal = stats && pageConfig?.kpis?.teleop?.subKey
    ? stats.getMetricValue(pageConfig.kpis.teleop.subKey)
    : null;

  // Endgame chart data if displayType === "chart"
  const endgameChartData = stats && pageConfig?.endgame
    ? pageConfig.endgame.states.map((state) => {
        const stateKey = pageConfig.endgame.stateKey;
        const rate =
          stats.rates[`${stateKey}.${state.value}`] ??
          stats.rates[`ending_robot_state.${state.value}`] ??
          stats.rates[`ending_based_state.${state.value}`] ??
          stats.rates[state.value] ??
          0;
        return {
          name: state.label,
          value: rate,
          fill: state.fill || "var(--chart-2)",
        };
      })
    : [];

  const endgameThemeConfig = {
    value: {
      label: "Rate %",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6 mt-2">
      {/* Subtitle */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-muted-foreground">
            {currentYear} {yearConfig?.gameName} performance analysis and scouting data
          </p>
        </div>
      </div>

      {/* Robot Image & Team Info */}
      <div className={`grid ${competitionType !== "FTC" ? "lg:grid-cols-2" : ""} gap-6`}>
        {competitionType !== "FTC" && (
          <div>
            <TeamImage
              teamNumber={teamNumber}
              yearLabel={`${currentYear} ${yearConfig?.gameName || ""}`}
              competitionType={competitionType}
            />
          </div>
        )}

        <div className="space-y-4">
          <TeamInfo
            teamNumber={teamNumber}
            driveTrain={teamData?.pitEntry?.driveTrain}
            weight={teamData?.pitEntry?.weight}
            matches={teamData?.matchCount}
          />

          <Button className={competitionType !== "FTC" ? "w-full" : "w-full md:w-auto"} variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Visit Team Website
          </Button>
        </div>
      </div>

      {/* 4 Key Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Average Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isNaN(averageScore) ? "0.0" : averageScore.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total points per match
            </p>
          </CardContent>
        </Card>

        {/* EPA Rating */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EPA Rating</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats ? (isNaN(stats.epa) ? "0.0" : stats.epa.toFixed(1)) : "0.0"}
            </div>
            <p className="text-xs text-muted-foreground">
              Expected points added
            </p>
          </CardContent>
        </Card>

        {/* Auto KPI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {pageConfig?.kpis?.auto?.label || "Autonomous"}
            </CardTitle>
            {renderDynamicIcon(pageConfig?.kpis?.auto?.icon || "Activity")}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isNaN(autoKpiVal) ? "0.0" : autoKpiVal.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average autonomous scoring
            </p>
            {autoKpiSubVal != null && (
              <p className="text-xs text-muted-foreground mt-1">
                {pageConfig?.kpis?.auto?.subLabel}: {autoKpiSubVal}
                {pageConfig?.kpis?.auto?.subFormat === "percent" ? "%" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Teleop KPI */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {pageConfig?.kpis?.teleop?.label || "Teleop"}
            </CardTitle>
            {renderDynamicIcon(pageConfig?.kpis?.teleop?.icon || "BarChart")}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isNaN(teleopKpiVal) ? "0.0" : teleopKpiVal.toFixed(1)}
              {pageConfig?.kpis?.teleop?.subFormat === "percent" ? "%" : ""}
            </div>
            <p className="text-xs text-muted-foreground">
              Average teleop scoring
            </p>
            {teleopKpiSubVal != null && (
              <p className="text-xs text-muted-foreground mt-1">
                {pageConfig?.kpis?.teleop?.subLabel}: {teleopKpiSubVal}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Breakdown (Auto & Teleop) */}
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
              {(pageConfig?.autoPerformance?.metrics || []).map((m) => {
                const val = stats ? stats.getMetricValue(m.key) : 0;
                return (
                  <div key={m.key} className="flex justify-between items-center">
                    <span className="text-sm">{m.label}</span>
                    {m.type === "badge" ? (
                      <Badge variant="secondary">
                        {val}
                        {m.unit || ""}
                      </Badge>
                    ) : (
                      <span className="font-medium">{val}</span>
                    )}
                  </div>
                );
              })}

              {pageConfig?.autoPerformance?.showPointsEstimate && stats && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-sm">Total Auto Points</span>
                    <span>{stats.points.autoEstimatedPoints} pts</span>
                  </div>
                </div>
              )}
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
              {(pageConfig?.teleopPerformance?.metrics || []).map((m) => {
                const val = stats ? stats.getMetricValue(m.key) : 0;
                return (
                  <div key={m.key} className="flex justify-between items-center">
                    <span className="text-sm">{m.label}</span>
                    {m.type === "badge" ? (
                      <Badge variant="secondary">
                        {val}
                        {m.unit || ""}
                      </Badge>
                    ) : (
                      <span className="font-medium">{val}</span>
                    )}
                  </div>
                );
              })}

              {pageConfig?.teleopPerformance?.showPointsEstimate && stats && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-sm">Total Teleop Points</span>
                    <span>{stats.points.teleopEstimatedPoints} pts</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Scoring Breakdown Chart */}
        {scoringBreakdownConfig && breakdownChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{scoringBreakdownConfig.title}</CardTitle>
              <CardDescription>{scoringBreakdownConfig.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartThemeConfig}>
                <RechartsBarChart
                  data={breakdownChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    angle={breakdownChartData.length > 5 ? -45 : 0}
                    textAnchor={breakdownChartData.length > 5 ? "end" : "middle"}
                    height={breakdownChartData.length > 5 ? 80 : 30}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <Bar dataKey="value" radius={8}>
                    {breakdownChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

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
        {/* Endgame Distribution */}
        {pageConfig?.endgame && (
          <Card>
            <CardHeader>
              <CardTitle>{pageConfig.endgame.title}</CardTitle>
              <CardDescription>{pageConfig.endgame.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {pageConfig.endgame.displayType === "chart" ? (
                <ChartContainer config={endgameThemeConfig}>
                  <RechartsBarChart
                    data={endgameChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                    />
                    <YAxis tickLine={false} axisLine={false} unit="%" />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="value" fill="var(--color-value)" radius={8} />
                  </RechartsBarChart>
                </ChartContainer>
              ) : (
                <div className={`grid grid-cols-2 md:grid-cols-${Math.min(pageConfig.endgame.states.length, 4)} gap-4`}>
                  {pageConfig.endgame.states.map((st) => {
                    const stateKey = pageConfig.endgame?.stateKey ?? "endgame.ending_robot_state";
                    const rate =
                      stats?.rates[`${stateKey}.${st.value}`] ??
                      stats?.rates[`ending_robot_state.${st.value}`] ??
                      stats?.rates[`ending_based_state.${st.value}`] ??
                      stats?.rates[st.value] ??
                      0;

                    return (
                      <div key={st.value}>
                        <h4 className="font-semibold mb-2">{st.label}</h4>
                        <Badge
                          variant={
                            st.highlightThreshold && rate > st.highlightThreshold
                              ? "default"
                              : "secondary"
                          }
                        >
                          {rate.toFixed(1)}%
                        </Badge>
                        {st.points != null && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {st.points} pts
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reliability & Penalties */}
        {pageConfig?.penalties && (
          <Card>
            <CardHeader>
              <CardTitle>{pageConfig.penalties.title}</CardTitle>
              <CardDescription>{pageConfig.penalties.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pageConfig.endgame?.breakdownKey && (
                  <div className="space-y-2 pb-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Robot Reliability
                    </h4>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Breakdown Rate</span>
                      <Badge
                        variant={
                          (stats?.rates[pageConfig.endgame.breakdownKey] ?? 0) >
                          (pageConfig.penalties.breakdownAlertThreshold ?? 15)
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {stats?.rates[pageConfig.endgame.breakdownKey]?.toFixed(1) || 0}%
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-sm">{pageConfig.penalties.minorLabel}</span>
                  <Badge variant="secondary">
                    {stats?.averages[pageConfig.penalties.minorKey]?.toFixed(1) || 0}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm">{pageConfig.penalties.majorLabel}</span>
                  <Badge
                    variant={
                      (stats?.averages[pageConfig.penalties.majorKey] ?? 0) >
                      (pageConfig.penalties.techFoulAlertThreshold ?? 0.5)
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {stats?.averages[pageConfig.penalties.majorKey]?.toFixed(1) || 0}
                  </Badge>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center font-semibold">
                    <span className="text-sm">Est. Penalty Points</span>
                    <Badge variant="secondary">
                      {stats ? stats.points.penaltyPoints.toFixed(1) : "0.0"} pts
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Custom Sections (e.g. Playstyle, Patterns) */}
      {pageConfig?.customSections?.map((section) => {
        if (section.type === "distribution" && section.fieldKey) {
          return (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                {section.description && (
                  <CardDescription>{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className={`grid md:grid-cols-${section.items?.length || 3} gap-6 text-center`}>
                  {section.items?.map((item) => {
                    const rate = stats?.rates[`${section.fieldKey}.${item.key}`] || 0;
                    return (
                      <div key={item.key}>
                        <h4 className="font-semibold mb-2">{item.label}</h4>
                        <div className="text-2xl font-bold">{rate.toFixed(1)}%</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        }

        if (section.type === "summaryCards" && section.items) {
          return (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                {section.description && (
                  <CardDescription>{section.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {section.items.map((item) => {
                    const avg = stats ? stats.getMetricValue(item.key) : 0;
                    const pts = item.pointsMultiplier ? avg * item.pointsMultiplier : 0;
                    return (
                      <div key={item.key}>
                        <h4 className="font-semibold mb-3">{item.label}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Average per Match</span>
                            <Badge variant="secondary">{avg.toFixed(1)}</Badge>
                          </div>
                          {item.pointsMultiplier && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm">{item.pointsLabel || "Points"}</span>
                              <Badge variant="secondary">{pts.toFixed(1)} pts</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        }

        return null;
      })}

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
              const pitData = teamData.pitEntry.gameSpecificData as Record<
                string,
                Record<string, unknown> | unknown
              >;
              const pitConfig = yearConfig?.pitScouting;

              // Render categories from pitScouting config or keys in pitData
              const categories = pitConfig
                ? Object.keys(pitConfig)
                : ["autonomous", "teleoperated", "endgame", "driveTeam"];

              return (
                <>
                  <div className="grid md:grid-cols-3 gap-6">
                    {categories.map((catKey) => {
                      const catFields = pitConfig?.[catKey as keyof typeof pitConfig] || {};
                      const catData = (pitData[catKey] || {}) as Record<string, unknown>;

                      // Collect fields to display
                      const fieldEntries: { label: string; value: string; isBool?: boolean }[] = [];

                      Object.entries(catFields).forEach(([fKey, fDef]) => {
                        const val =
                          (pitData as Record<string, unknown>)[`${catKey}_${fKey}`] ??
                          catData[fKey];
                        if (val != null && val !== "") {
                          const displayVal = Array.isArray(val)
                            ? val.join(", ")
                            : typeof val === "boolean"
                              ? val ? "Yes" : "No"
                              : String(val);
                          fieldEntries.push({
                            label: fDef.label,
                            value: displayVal,
                            isBool: typeof val === "boolean",
                          });
                        }
                      });

                      // Also check any flat keys matching prefix if not in defs
                      Object.entries(pitData).forEach(([rawKey, val]) => {
                        if (rawKey.startsWith(`${catKey}_`)) {
                          const simpleKey = rawKey.replace(`${catKey}_`, "");
                          if (!catFields[simpleKey] && val != null && val !== "") {
                            const label = simpleKey
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (str) => str.toUpperCase());
                            const displayVal = Array.isArray(val)
                              ? val.join(", ")
                              : typeof val === "boolean"
                                ? val ? "Yes" : "No"
                                : String(val);
                            fieldEntries.push({
                              label,
                              value: displayVal,
                              isBool: typeof val === "boolean",
                            });
                          }
                        }
                      });

                      if (fieldEntries.length === 0) return null;

                      return (
                        <div key={catKey}>
                          <h4 className="font-semibold mb-3 capitalize">
                            {catKey === "driveTeam" ? "Drive Team" : catKey}
                          </h4>
                          <div className="space-y-2">
                            {fieldEntries.map((f, i) => (
                              <div key={i} className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  {f.label}
                                </span>
                                <Badge
                                  variant={
                                    f.isBool
                                      ? f.value === "Yes"
                                        ? "default"
                                        : "secondary"
                                      : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {f.value}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Robot Dimensions */}
                  {(teamData.pitEntry.length || teamData.pitEntry.width) && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Robot Dimensions
                      </h4>
                      <div className="flex gap-6">
                        {teamData.pitEntry.length != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Length:
                            </span>
                            <Badge variant="secondary">
                              {teamData.pitEntry.length}&quot;
                            </Badge>
                          </div>
                        )}
                        {teamData.pitEntry.width != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Width:
                            </span>
                            <Badge variant="secondary">
                              {teamData.pitEntry.width}&quot;
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pit Notes */}
                  {teamData.pitEntry.notes && teamData.pitEntry.notes.trim() && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-semibold mb-2">Pit Scout Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {teamData.pitEntry.notes}
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Autonomous Path Drawing */}
      {teamData?.pitEntry?.autoDrawing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Autonomous Path
            </CardTitle>
            <CardDescription>
              Robot autonomous path drawn during pit scouting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldDrawingCanvas
              initialData={teamData.pitEntry.autoDrawing}
              readOnly
            />
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

export default ConfigurableTeamPage;
