"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  Trophy,
  Plus,
  Sliders,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import type { YearConfig, TeamPageConfig } from "@/lib/types";
import { buildDatapointRegistry } from "@/lib/game-config/datapoint-registry";
import { buildPreviewTeamData } from "@/lib/game-config/preview-stats";
import { ConfigurableTeamPage } from "@/components/team-pages/configurable-team-page";
import { TeamPageInspector } from "./team-page-inspector";
import { buildTeamPageDefaults } from "@/lib/game-config/team-page-defaults";

interface VisualTeamPageCanvasProps {
  config: YearConfig;
  year: number;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
}

export function VisualTeamPageCanvas({
  config,
  year,
  onUpdateConfig,
}: VisualTeamPageCanvasProps) {
  const [selectedSection, setSelectedSection] = useState<"kpi" | "autoPerformance" | "teleopPerformance" | "chart" | "endgame" | "penalties">("kpi");
  const previewTeamData = React.useMemo(
    () => buildPreviewTeamData(config),
    [config],
  );

  const teamPageConfig = config.teamPageConfig ?? buildTeamPageDefaults(config);

  const updateTeamPage = (patch: Partial<TeamPageConfig>) => {
    onUpdateConfig((prev) => ({
      ...prev,
      teamPageConfig: {
        ...(prev.teamPageConfig || teamPageConfig),
        ...patch,
      },
    }));
  };

  const handleAddChartItem = () => {
    const defaultColors = ["#f97316", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6"];
    const existingItems = teamPageConfig.scoringBreakdownChart?.items || [];
    const color = defaultColors[existingItems.length % defaultColors.length];

    const newItem = {
      name: `Category ${existingItems.length + 1}`,
      key: buildDatapointRegistry(config).find((d) => !d.pitSection && d.valueType === "number")?.key || "",
      fill: color,
    };

    updateTeamPage({
      scoringBreakdownChart: {
        ...teamPageConfig.scoringBreakdownChart,
        title: teamPageConfig.scoringBreakdownChart?.title || "Scoring Breakdown",
        description: teamPageConfig.scoringBreakdownChart?.description || "",
        items: [...existingItems, newItem],
      },
    });
    setSelectedSection("chart");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Quick Actions & Elements (3 cols) */}
      <div className="lg:col-span-3 min-w-0 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <LayoutDashboard className="h-4 w-4 text-primary" />
              Team Page Designer
            </CardTitle>
            <CardDescription className="text-xs">
              Configure how team performance widgets, KPIs, charts, and penalties appear on profile pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Select Section to Edit
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {(["autoPerformance", "teleopPerformance"] as const).map((section) => (
                  <Button key={section} type="button" size="sm" className="justify-start text-xs h-8"
                    variant={selectedSection === section ? "default" : "outline"}
                    onClick={() => setSelectedSection(section)}>
                    {section === "autoPerformance" ? "Autonomous Performance" : "Teleop Performance"}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={selectedSection === "kpi" ? "default" : "outline"}
                  onClick={() => setSelectedSection("kpi")}
                  className="justify-start text-xs h-8"
                >
                  <Activity className="h-3.5 w-3.5 mr-2 text-primary" /> Primary KPIs
                </Button>
                <Button
                  size="sm"
                  variant={selectedSection === "chart" ? "default" : "outline"}
                  onClick={() => setSelectedSection("chart")}
                  className="justify-start text-xs h-8"
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-2 text-amber-500" /> Scoring Breakdown Chart
                </Button>
                <Button
                  size="sm"
                  variant={selectedSection === "endgame" ? "default" : "outline"}
                  onClick={() => setSelectedSection("endgame")}
                  className="justify-start text-xs h-8"
                >
                  <Trophy className="h-3.5 w-3.5 mr-2 text-purple-500" /> Endgame Distribution
                </Button>
                <Button
                  size="sm"
                  variant={selectedSection === "penalties" ? "default" : "outline"}
                  onClick={() => setSelectedSection("penalties")}
                  className="justify-start text-xs h-8"
                >
                  <ShieldAlert className="h-3.5 w-3.5 mr-2 text-rose-500" /> Penalties & Fouls
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Quick Actions
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={handleAddChartItem}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" /> Add Breakdown Chart Bar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center Column: the real team page, rendered against preview data (6 cols) */}
      <div className="lg:col-span-6 min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Live Team Page
            Preview
          </span>
          <Badge variant="outline" className="text-[10px]">
            Sample data
          </Badge>
        </div>
        <div className="rounded-xl border bg-background overflow-y-auto max-h-[1100px] p-4">
          <ConfigurableTeamPage
            teamNumber={String(previewTeamData.teamNumber)}
            yearOverride={year}
            configOverride={{ ...config, teamPageConfig }}
            teamDataOverride={previewTeamData}
          />
        </div>
      </div>

      {/* Right Column: Property Inspector (3 cols) */}
      <div className="lg:col-span-3 min-w-0 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Team Page Inspector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TeamPageInspector
              section={selectedSection}
              config={config}
              value={teamPageConfig}
              onChange={updateTeamPage}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
