"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Table2, TrendingUp, Activity } from "lucide-react";
import { useAnalysisStats } from "@/hooks/use-analysis-stats";
import { useGameConfig } from "@/hooks/use-game-config";
import type { AnalysisInsightDefinition } from "@/lib/types";

const StackedEPAChart = dynamic(
  () =>
    import("@/components/charts/stacked-epa-chart").then(
      (mod) => mod.StackedEPAChart,
    ),
  {
    loading: () => (
      <div className="text-sm text-muted-foreground">Loading chart...</div>
    ),
  },
);

const EPATable = dynamic(
  () => import("@/components/tables/epa-table").then((mod) => mod.EPATable),
  {
    loading: () => (
      <div className="text-sm text-muted-foreground">Loading table...</div>
    ),
  },
);

type InsightItem = {
  team: string;
  value: number;
  raw: string;
  displayValue?: string;
  rawLabel?: string;
};

type InsightResult = {
  best: InsightItem[];
  worst: InsightItem[];
};

function buildTopBottom(
  items: InsightItem[],
  count: number,
  better: "higher" | "lower",
): InsightResult {
  const best = [...items]
    .sort((a, b) =>
      better === "higher" ? b.value - a.value : a.value - b.value,
    )
    .slice(0, count);
  const worst = [...items]
    .sort((a, b) =>
      better === "higher" ? a.value - b.value : b.value - a.value,
    )
    .slice(0, count);
  return { best, worst };
}

function formatInsightValue(item: InsightItem) {
  const raw = item.rawLabel ? `${item.rawLabel}: ${item.raw}` : item.raw;
  if (item.displayValue) return `${raw} • ${item.displayValue}`;
  return raw;
}

function InsightSection({
  title,
  description,
  best,
  worst,
}: {
  title: string;
  description?: string;
  best: InsightItem[];
  worst: InsightItem[];
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Best</p>
          {best.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {best.map((item) => (
                <li
                  key={`best-${title}-${item.team}`}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium">
                    Team {item.team}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatInsightValue(item)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Worst</p>
          {worst.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ul className="space-y-2">
              {worst.map((item) => (
                <li
                  key={`worst-${title}-${item.team}`}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium">
                    Team {item.team}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatInsightValue(item)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { stats, loading } = useAnalysisStats();
  const { getCurrentYearConfig } = useGameConfig();
  const currentConfig = getCurrentYearConfig();
  const insightDefinitions = useMemo(
    () => currentConfig?.analysisInsights?.insights ?? [], [currentConfig],
  );
  const insights = useMemo(() => {
    function formatValue(value: number, format?: "percent" | "number") {
      if (format === "percent") return `${(value * 100).toFixed(1)}%`;
      return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }

    function buildItems(definition: AnalysisInsightDefinition): InsightItem[] {
      return stats.teamEPAData
        .map<InsightItem | null>((team) => {
          const matches = team.matchesPlayed;
          const rawLabel = definition.rawLabel;

          if (definition.calculation.type === "booleanRate") {
            const ratePercent =
              team.detailMetrics[definition.calculation.key];
            if (ratePercent === undefined || matches === 0) return null;
            const rate = ratePercent / 100;
            const count = Math.round(rate * matches);
            const item: InsightItem = {
              team: team.team,
              value: rate,
              raw: `${count}/${matches}`,
              displayValue: formatValue(rate, definition.valueFormat),
            };
            if (rawLabel) item.rawLabel = rawLabel;
            return item;
          }

          if (definition.calculation.type === "ratio") {
            const numeratorAvg = definition.calculation.numeratorKeys.reduce(
              (sum, key) => sum + (team.detailMetrics[key] ?? 0),
              0,
            );
            const denominatorAvg =
              definition.calculation.denominatorKeys.reduce(
                (sum, key) => sum + (team.detailMetrics[key] ?? 0),
                0,
              );
            if (denominatorAvg <= 0 || matches === 0) return null;
            const numeratorTotal = numeratorAvg * matches;
            const denominatorTotal = denominatorAvg * matches;
            const ratio = numeratorTotal / denominatorTotal;
            const item: InsightItem = {
              team: team.team,
              value: ratio,
              raw: `${Math.round(numeratorTotal)}/${Math.round(denominatorTotal)}`,
              displayValue: formatValue(ratio, definition.valueFormat),
            };
            if (rawLabel) item.rawLabel = rawLabel;
            return item;
          }

          const sumAvg = definition.calculation.keys.reduce(
            (sum, key) => sum + (team.detailMetrics[key] ?? 0),
            0,
          );
          if (matches === 0) return null;
          const total = sumAvg * matches;
          const item: InsightItem = {
            team: team.team,
            value: total,
            raw: `${Math.round(total)}`,
            displayValue: formatValue(total, definition.valueFormat),
          };
          if (rawLabel) item.rawLabel = rawLabel;
          return item;
        })
        .filter((item): item is InsightItem => item !== null);
    }

    return insightDefinitions.map((definition) => ({
      definition,
      result: buildTopBottom(buildItems(definition), 3, definition.ranking),
    }));
  }, [insightDefinitions, stats.teamEPAData]);
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analysis</h1>
        <p className="text-muted-foreground">
          Analyze team performance with EPA (Expected Points Added) metrics and
          visualizations
        </p>
      </div>

      {/* Analysis Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Teams Analyzed</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : stats.teamsAnalyzed}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Highest EPA</p>
                <p className="text-2xl font-bold">
                  {loading
                    ? "..."
                    : isNaN(stats.highestEPA)
                      ? "N/A"
                      : stats.highestEPA}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average EPA</p>
                <p className="text-2xl font-bold">
                  {loading
                    ? "..."
                    : isNaN(stats.averageEPA)
                      ? "N/A"
                      : stats.averageEPA}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Data Points</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : stats.dataPoints}
                </p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <Table2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Views */}
      <Card>
        <CardHeader>
          <CardTitle>EPA Analysis</CardTitle>
          <CardDescription>
            Switch between chart and table views to explore team performance
            data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="graph" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="graph" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Chart View
              </TabsTrigger>
              <TabsTrigger value="table" className="flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                Table View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="graph" className="space-y-4">
              <StackedEPAChart data={stats.teamEPAData} />
            </TabsContent>

            <TabsContent value="table" className="space-y-4">
              <EPATable
                data={stats.teamEPAData}
                metrics={stats.availableMetrics}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insights</CardTitle>
          <CardDescription>
            Top and bottom teams based on configured insight metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">
              Loading insights...
            </div>
          ) : insightDefinitions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No insights configured for this year.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {insights.map(({ definition, result }) => (
                <InsightSection
                  key={definition.id}
                  title={definition.title}
                  description={definition.description}
                  best={result.best}
                  worst={result.worst}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
