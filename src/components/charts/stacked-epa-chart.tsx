"use client";

import {
  Bar,
  BarChart,
  BarShapeProps,
  CartesianGrid,
  ComposedChart,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSelectedEvent } from "@/hooks/use-event-config";
import { useGameConfig } from "@/hooks/use-game-config";
import { useAsyncData } from "@/hooks/use-async-data";
type TeamEPAChartDatum = {
  team: string;
  auto: number;
  teleop: number;
  endgame: number;
  penalties: number;
  totalEPA: number;
  totalEPAStats?: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  };
};

// Define types for better type safety
interface TooltipPayload {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: Record<string, unknown>;
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

interface BoxPlotDatum {
  categoryKey: string;
  label: string;
  color: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  lowerWhisker: number; // q1 - min
  upperWhisker: number; // max - q3
  range: [number, number];
}

// Custom tooltip content to include total
function CustomChartTooltipContent(props: TooltipProps) {
  const { active, payload, label } = props;
  if (!active || !payload || !payload.length) return null;

  // Type the payload properly
  const data = payload[0]?.payload as { totalEPA?: number };
  const total = typeof data?.totalEPA === "number" ? data.totalEPA : 0;

  return (
    <div className="p-2 bg-background rounded-md shadow-md border">
      <div className="font-semibold mb-1">Team: {label}</div>
      {payload.map((entry: TooltipPayload) => (
        <div key={entry.dataKey} className="flex justify-between gap-2">
          <span style={{ color: entry.color }}>{entry.name}:</span>
          <span>
            {typeof entry.value === "number"
              ? entry.value.toFixed(3)
              : entry.value}
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-2 mt-2 font-bold">
        <span>Total:</span>
        <span>{total.toFixed(3)}</span>
      </div>
    </div>
  );
}

function BoxPlotTooltipContent(props: TooltipProps) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload as unknown as BoxPlotDatum | undefined;
  if (!data) return null;

  return (
    <div className="p-2 bg-background rounded-md shadow-md border">
      <div className="font-semibold mb-1">{data.label}</div>
      <div className="flex justify-between gap-2">
        <span>Min:</span>
        <span>{data.min.toFixed(3)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Q1:</span>
        <span>{data.q1.toFixed(3)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Median:</span>
        <span>{data.median.toFixed(3)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Q3:</span>
        <span>{data.q3.toFixed(3)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Max:</span>
        <span>{data.max.toFixed(3)}</span>
      </div>
    </div>
  );
}

export const description = "A stacked bar chart with a legend";

const chartConfig = {
  penalties: {
    label: "Penalties",
    color: "var(--chart-1)",
  },
  endgame: {
    label: "Endgame",
    color: "var(--chart-2)",
  },
  teleop: {
    label: "Teleop",
    color: "var(--chart-3)",
  },
  auto: {
    label: "Auto",
    color: "var(--chart-4)",
  },
  total: {
    label: "Total",
    color: "var(--chart-5)",
  },
};

type TeamColorsMap = Record<
  string,
  { primaryHex?: string; secondaryHex?: string; verified?: boolean }
>;

const buildBoxPlotData = (
  data: TeamEPAChartDatum[],
  teamColors: TeamColorsMap,
) =>
  data.map((entry, index) => {
    const stats = entry.totalEPAStats;
    const min = stats?.min ?? entry.totalEPA;
    const q1 = stats?.q1 ?? entry.totalEPA;
    const median = stats?.median ?? entry.totalEPA;
    const q3 = stats?.q3 ?? entry.totalEPA;
    const max = stats?.max ?? entry.totalEPA;
    const iqr = q3 - q1;
    const range: [number, number] = [median - min, max - median];

    const teamColor = teamColors[entry.team]?.primaryHex;
    const color = teamColor || "var(--color-total)";

    const lowerWhisker = q1 - min;
    const upperWhisker = max - q3;

    return {
      categoryKey: `${entry.team}__${index}`,
      label: entry.team,
      color,
      min,
      q1,
      median,
      q3,
      max,
      iqr,
      lowerWhisker,
      upperWhisker,
      range,
    } satisfies BoxPlotDatum;
  });

// Custom interactive legend component
function CustomLegend({
  visibleCategories,
  onToggle,
}: {
  visibleCategories: Record<string, boolean>;
  onToggle: (category: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {Object.entries(chartConfig)
        .filter(([key]) => key !== "total")
        .reverse()
        .map(([key, config]) => {
          const isVisible = visibleCategories[key];
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ opacity: isVisible ? 1 : 0.3 }}
            >
              <div
                className="w-2 h-2 rounded-[2px] transition-all duration-200"
                style={{
                  backgroundColor: isVisible ? config.color : "transparent",
                  border: isVisible ? "none" : `1.5px solid ${config.color}`,
                }}
              />
              <span
                className="text-xs font-medium transition-all duration-200"
                style={{
                  color: isVisible
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
                  textDecoration: isVisible ? "none" : "line-through",
                }}
              >
                {config.label}
              </span>
            </button>
          );
        })}
    </div>
  );
}

const NO_TEAM_COLORS: TeamColorsMap = {};

export function StackedEPAChart({ data }: { data?: TeamEPAChartDatum[] }) {
  const displayData = useMemo(() => data ?? [], [data]);
  const isMobile = useIsMobile();
  const selectedEvent = useSelectedEvent();
  const { competitionType } = useGameConfig();
  const [chartView, setChartView] = useState<"stacked" | "box">("stacked");

  // State for toggling categories (all visible by default)
  const [visibleCategories, setVisibleCategories] = useState<
    Record<string, boolean>
  >({
    auto: true,
    teleop: true,
    endgame: true,
    penalties: true,
  });

  const toggleCategory = (category: string) => {
    setVisibleCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const eventCode = selectedEvent?.eventCode;
  const { data: fetchedTeamColors } = useAsyncData<TeamColorsMap>(
    eventCode && competitionType === "FRC"
      ? `${eventCode}|${competitionType}`
      : null,
    async () => {
      try {
        const response = await fetch(
          `/api/events/${encodeURIComponent(eventCode!)}/colors?competitionType=${competitionType}`,
        );

        if (!response.ok) {
          return NO_TEAM_COLORS;
        }

        const data = (await response.json()) as {
          teams?: Record<
            string,
            {
              teamNumber: number;
              colors: {
                primaryHex: string;
                secondaryHex: string;
                verified: boolean;
              } | null;
            }
          >;
        };

        const colorMap: TeamColorsMap = {};
        Object.values(data.teams || {}).forEach((team) => {
          if (team?.teamNumber && team.colors?.primaryHex) {
            colorMap[String(team.teamNumber)] = {
              primaryHex: team.colors.primaryHex,
              secondaryHex: team.colors.secondaryHex,
              verified: team.colors.verified,
            };
          }
        });

        return colorMap;
      } catch (error) {
        console.warn("Failed to load team colors:", error);
        return NO_TEAM_COLORS;
      }
    },
  );
  const teamColors = fetchedTeamColors ?? NO_TEAM_COLORS;

  const boxPlotData = useMemo(
    () => buildBoxPlotData(displayData, teamColors),
    [displayData, teamColors],
  );

  const yDomain = useMemo((): [number, number] => {
    let min = 0;
    let max = 0;

    displayData.forEach((entry) => {
      const statsMin = entry.totalEPAStats?.min ?? entry.totalEPA;
      const statsMax = entry.totalEPAStats?.max ?? entry.totalEPA;

      if (Number.isFinite(statsMin)) min = Math.min(min, statsMin);
      if (Number.isFinite(statsMax)) max = Math.max(max, statsMax);
    });

    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 0;

    return [min, max];
  }, [displayData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>EPA Graph</CardTitle>
            <CardDescription>
              {chartView === "stacked"
                ? `${isMobile ? "Scroll horizontally • " : ""}Click legend items to toggle categories`
                : "Total EPA distribution per team"}
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={chartView}
            onValueChange={(value) => {
              if (value === "stacked" || value === "box") {
                setChartView(value);
              }
            }}
            size="sm"
            variant="outline"
            spacing={0}
          >
            <ToggleGroupItem value="stacked">Stacked</ToggleGroupItem>
            <ToggleGroupItem value="box">Box & Whisker</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        <div className={isMobile ? "overflow-x-auto -mx-6 px-6" : ""}>
          <ChartContainer
            config={chartConfig}
            className={isMobile ? "min-w-[600px]" : ""}
          >
            {chartView === "stacked" ? (
              <BarChart
                accessibilityLayer
                data={displayData}
                stackOffset="sign"
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="team"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) =>
                    value.length > 4 ? value.slice(0, 4) + "..." : value
                  }
                />
                <ChartTooltip content={<CustomChartTooltipContent />} />
                {visibleCategories.penalties && (
                  <Bar
                    dataKey="penalties"
                    stackId="a"
                    fill="var(--color-penalties)"
                    radius={[4, 4, 0, 0]}
                    animationDuration={300}
                  />
                )}
                {visibleCategories.endgame && (
                  <Bar
                    dataKey="endgame"
                    stackId="a"
                    fill="var(--color-endgame)"
                    radius={[0, 0, 0, 0]}
                    animationDuration={300}
                  />
                )}
                {visibleCategories.teleop && (
                  <Bar
                    dataKey="teleop"
                    stackId="a"
                    fill="var(--color-teleop)"
                    radius={[0, 0, 0, 0]}
                    animationDuration={300}
                  />
                )}
                {visibleCategories.auto && (
                  <Bar
                    dataKey="auto"
                    stackId="a"
                    fill="var(--color-auto)"
                    radius={[4, 4, 0, 0]}
                    animationDuration={300}
                  />
                )}
                <YAxis domain={yDomain} />
              </BarChart>
            ) : (
              <ComposedChart accessibilityLayer data={boxPlotData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="categoryKey"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const label = value.split("__")[0] || value;
                    return label.length > 4 ? label.slice(0, 4) + "..." : label;
                  }}
                />
                <YAxis domain={yDomain} />
                <ChartTooltip content={<BoxPlotTooltipContent />} />

                {/* Invisible base to offset stack to min */}
                <Bar
                  dataKey="min"
                  stackId="box"
                  fill="transparent"
                  stroke="transparent"
                  isAnimationActive={false}
                />

                {/* Lower whisker — thin centered line */}
                <Bar
                  dataKey="lowerWhisker"
                  stackId="box"
                  isAnimationActive={false}
                  shape={(props: BarShapeProps & { index?: number }) => {
                    const entry = boxPlotData[props.index ?? 0];
                    if (
                      !entry ||
                      props.x == null ||
                      props.y == null ||
                      props.width == null ||
                      props.height == null
                    )
                      return <g />;
                    const cx = props.x + props.width / 2;
                    const capWidth = 10;
                    return (
                      <g stroke={entry.color} strokeWidth={2}>
                        {/* Vertical line */}
                        <line
                          x1={cx}
                          x2={cx}
                          y1={props.y}
                          y2={props.y + props.height}
                        />
                        {/* Bottom cap (min) */}
                        <line
                          x1={cx - capWidth / 2}
                          x2={cx + capWidth / 2}
                          y1={props.y + props.height}
                          y2={props.y + props.height}
                        />
                      </g>
                    );
                  }}
                />

                {/* IQR box */}
                <Bar
                  dataKey="iqr"
                  stackId="box"
                  isAnimationActive={false}
                  shape={(props: BarShapeProps & { index?: number }) => {
                    const entry = boxPlotData[props.index ?? 0];
                    if (
                      !entry ||
                      props.x == null ||
                      props.y == null ||
                      props.width == null ||
                      props.height == null ||
                      !Number.isFinite(props.height)
                    )
                      return <g />;
                    const medianY =
                      entry.iqr === 0
                        ? props.y + props.height / 2
                        : props.y +
                          props.height *
                            ((entry.q3 - entry.median) / entry.iqr);
                    return (
                      <g>
                        <rect
                          x={props.x}
                          y={props.y}
                          width={props.width}
                          height={props.height}
                          fill={entry.color}
                          fillOpacity={0.25}
                          stroke={entry.color}
                          strokeWidth={2}
                          rx={4}
                          ry={4}
                        />
                        {/* Median line inside box */}
                        <line
                          x1={props.x}
                          x2={props.x + props.width}
                          y1={medianY}
                          y2={medianY}
                          stroke={entry.color}
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }}
                />

                {/* Upper whisker */}
                <Bar
                  dataKey="upperWhisker"
                  stackId="box"
                  isAnimationActive={false}
                  shape={(props: BarShapeProps & { index?: number }) => {
                    const entry = boxPlotData[props.index ?? 0];
                    if (
                      !entry ||
                      props.x == null ||
                      props.y == null ||
                      props.width == null ||
                      props.height == null
                    )
                      return <g />;
                    const cx = props.x + props.width / 2;
                    const capWidth = 10;
                    return (
                      <g stroke={entry.color} strokeWidth={2}>
                        <line
                          x1={cx}
                          x2={cx}
                          y1={props.y}
                          y2={props.y + props.height}
                        />
                        {/* Top cap (max) */}
                        <line
                          x1={cx - capWidth / 2}
                          x2={cx + capWidth / 2}
                          y1={props.y}
                          y2={props.y}
                        />
                      </g>
                    );
                  }}
                />
              </ComposedChart>
            )}
          </ChartContainer>
        </div>
        {chartView === "stacked" && (
          <CustomLegend
            visibleCategories={visibleCategories}
            onToggle={toggleCategory}
          />
        )}
      </CardContent>
    </Card>
  );
}
