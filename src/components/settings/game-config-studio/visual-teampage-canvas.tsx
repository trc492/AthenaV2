"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  Flame,
  Zap,
  Target,
  Trophy,
  AlertTriangle,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import type { YearConfig, TeamPageConfig } from "@/lib/types";

interface VisualTeamPageCanvasProps {
  config: YearConfig;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
}

export function VisualTeamPageCanvas({
  config,
  onUpdateConfig,
}: VisualTeamPageCanvasProps) {
  const [selectedSection, setSelectedSection] = useState<"kpi" | "chart" | "endgame" | "penalties">("kpi");
  const [selectedChartItemIdx, setSelectedChartItemIdx] = useState<number | null>(null);

  const teamPageConfig: TeamPageConfig = config.teamPageConfig || {
    kpis: {
      auto: {
        key: "autonomous.fuel_scored",
        label: "Avg Fuel (Auto)",
        subKey: "autonomous.climb",
        subLabel: "Climb rate",
        subFormat: "percent",
        icon: "Activity",
      },
      teleop: {
        key: "teleop.fuel_scored",
        label: "Avg Fuel Scored",
        subKey: "teleop.fuel_accuracy",
        subLabel: "Accuracy",
        subFormat: "percent",
        icon: "Flame",
      },
    },
    autoPerformance: { metrics: [], showPointsEstimate: true },
    teleopPerformance: { metrics: [], showPointsEstimate: true },
    scoringBreakdownChart: {
      title: "Fuel Scoring Breakdown",
      description: "Average fuel actions per match",
      items: [
        { name: "Auto Scored", key: "autonomous.fuel_scored", fill: "#f97316" },
        { name: "Auto Missed", key: "autonomous.fuel_missed", fill: "#fdba74" },
        { name: "Teleop Scored", key: "teleop.fuel_scored", fill: "#ef4444" },
        { name: "Teleop Passed", key: "teleop.fuel_passed", fill: "#3b82f6" },
      ],
    },
    endgame: {
      title: "Endgame Climb Distribution",
      description: "Percentage of matches at each climb level",
      displayType: "chart",
      stateKey: "endgame.ending_robot_state",
      states: [
        { value: "none", label: "None", points: 0 },
        { value: "L1", label: "L1", points: 10 },
        { value: "L2", label: "L2", points: 20 },
        { value: "L3", label: "L3", points: 30 },
      ],
    },
    penalties: {
      title: "Reliability & Penalties",
      description: "Robot reliability and penalty averages",
      minorKey: "fouls.fouls",
      minorLabel: "Avg Fouls per Match",
      minorPoints: -3,
      majorKey: "fouls.tech_fouls",
      majorLabel: "Avg Tech Fouls per Match",
      majorPoints: -10,
      techFoulAlertThreshold: 0.5,
      breakdownAlertThreshold: 20,
    },
  };

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
      key: "teleop.fuel_scored",
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
    setSelectedChartItemIdx(existingItems.length);
    setSelectedSection("chart");
  };

  const handleRemoveChartItem = (idx: number) => {
    const existingItems = teamPageConfig.scoringBreakdownChart?.items || [];
    updateTeamPage({
      scoringBreakdownChart: {
        ...teamPageConfig.scoringBreakdownChart,
        title: teamPageConfig.scoringBreakdownChart?.title || "Scoring Breakdown",
        description: teamPageConfig.scoringBreakdownChart?.description || "",
        items: existingItems.filter((_, i) => i !== idx),
      },
    });
    if (selectedChartItemIdx === idx) setSelectedChartItemIdx(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Quick Actions & Elements (3 cols) */}
      <div className="lg:col-span-3 space-y-4">
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

      {/* Center Column: Live WYSIWYG Team Page Layout Preview (6 cols) */}
      <div className="lg:col-span-6 space-y-5">
        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Live Team Page Profile Preview
        </span>

        {/* 1. Top KPI Cards Preview */}
        <div
          onClick={() => setSelectedSection("kpi")}
          className={`grid grid-cols-1 sm:grid-cols-2 gap-4 cursor-pointer p-2 rounded-xl transition-all ${
            selectedSection === "kpi" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
        >
          {/* Auto KPI */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {teamPageConfig.kpis?.auto?.label || "Avg Auto Scored"}
              </CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">18.4</div>
              <p className="text-xs text-muted-foreground mt-1">
                {teamPageConfig.kpis?.auto?.subLabel || "Climb rate"}:{" "}
                <span className="text-foreground font-semibold">92%</span>
              </p>
            </CardContent>
          </Card>

          {/* Teleop KPI */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {teamPageConfig.kpis?.teleop?.label || "Avg Teleop Scored"}
              </CardTitle>
              <Flame className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-foreground">34.2</div>
              <p className="text-xs text-muted-foreground mt-1">
                {teamPageConfig.kpis?.teleop?.subLabel || "Accuracy"}:{" "}
                <span className="text-foreground font-semibold">88%</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Scoring Breakdown Bar Chart Preview */}
        <div
          onClick={() => setSelectedSection("chart")}
          className={`p-2 rounded-xl cursor-pointer transition-all ${
            selectedSection === "chart" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/30"
          }`}
        >
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {teamPageConfig.scoringBreakdownChart?.title || "Scoring Breakdown"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {teamPageConfig.scoringBreakdownChart?.description || "Average scoring actions per match"}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  Chart Preview
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Visual Simulated Bar Chart */}
              <div className="h-36 flex items-end gap-3 pt-6 pb-2 px-2 border-b">
                {(teamPageConfig.scoringBreakdownChart?.items || []).map((item, idx) => {
                  const heights = [65, 30, 85, 45, 55, 40];
                  const heightPercent = heights[idx % heights.length];
                  const isSelected = selectedChartItemIdx === idx;
                  return (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedChartItemIdx(idx);
                        setSelectedSection("chart");
                      }}
                      className="flex-1 flex flex-col items-center gap-1 group/bar cursor-pointer"
                    >
                      <span className="text-[10px] font-mono text-muted-foreground opacity-0 group-hover/bar:opacity-100">
                        {heightPercent}%
                      </span>
                      <div
                        style={{
                          height: `${heightPercent}%`,
                          backgroundColor: item.fill || "#3b82f6",
                        }}
                        className={`w-full rounded-t-sm transition-all ${
                          isSelected ? "ring-2 ring-foreground scale-105" : "hover:opacity-90"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend with Color Swatches */}
              <div className="flex flex-wrap gap-2 pt-1">
                {(teamPageConfig.scoringBreakdownChart?.items || []).map((item, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChartItemIdx(idx);
                      setSelectedSection("chart");
                    }}
                    className={`text-xs px-2 py-1 flex items-center gap-1.5 cursor-pointer ${
                      selectedChartItemIdx === idx ? "ring-2 ring-primary border-primary" : ""
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.fill || "#3b82f6" }}
                    />
                    <span>{item.name}</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. Endgame Distribution & Penalties Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Endgame */}
          <div
            onClick={() => setSelectedSection("endgame")}
            className={`p-1 rounded-xl cursor-pointer transition-all ${
              selectedSection === "endgame" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/30"
            }`}
          >
            <Card className="h-full shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  {teamPageConfig.endgame?.title || "Endgame Distribution"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(teamPageConfig.endgame?.states || []).map((st) => (
                  <div key={st.value} className="flex justify-between items-center text-xs p-1.5 rounded bg-muted/40 border">
                    <span className="font-medium">{st.label}</span>
                    <span className="font-mono font-bold text-primary">{st.points ?? 0} pts</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Penalties */}
          <div
            onClick={() => setSelectedSection("penalties")}
            className={`p-1 rounded-xl cursor-pointer transition-all ${
              selectedSection === "penalties" ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/30"
            }`}
          >
            <Card className="h-full shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  {teamPageConfig.penalties?.title || "Reliability & Penalties"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-1.5 rounded bg-muted/40 border">
                  <span>{teamPageConfig.penalties?.minorLabel || "Minor Fouls"}</span>
                  <span className="font-mono text-rose-500 font-bold">
                    {teamPageConfig.penalties?.minorPoints ?? -3} pts
                  </span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-muted/40 border">
                  <span>{teamPageConfig.penalties?.majorLabel || "Major Fouls"}</span>
                  <span className="font-mono text-rose-500 font-bold">
                    {teamPageConfig.penalties?.majorPoints ?? -10} pts
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Right Column: Property Inspector (3 cols) */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Team Page Inspector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Inspector for KPIs */}
            {selectedSection === "kpi" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-primary">Autonomous KPI</span>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={teamPageConfig.kpis?.auto?.label || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateTeamPage({
                          kpis: {
                            ...teamPageConfig.kpis,
                            auto: { ...teamPageConfig.kpis?.auto, key: teamPageConfig.kpis?.auto?.key || "", label: val },
                            teleop: teamPageConfig.kpis?.teleop || { key: "", label: "" },
                          },
                        });
                      }}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Field Key</Label>
                    <Input
                      value={teamPageConfig.kpis?.auto?.key || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateTeamPage({
                          kpis: {
                            ...teamPageConfig.kpis,
                            auto: { ...teamPageConfig.kpis?.auto, label: teamPageConfig.kpis?.auto?.label || "", key: val },
                            teleop: teamPageConfig.kpis?.teleop || { key: "", label: "" },
                          },
                        });
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <span className="text-xs font-bold text-amber-500">Teleoperated KPI</span>
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={teamPageConfig.kpis?.teleop?.label || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateTeamPage({
                          kpis: {
                            ...teamPageConfig.kpis,
                            auto: teamPageConfig.kpis?.auto || { key: "", label: "" },
                            teleop: { ...teamPageConfig.kpis?.teleop, key: teamPageConfig.kpis?.teleop?.key || "", label: val },
                          },
                        });
                      }}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Field Key</Label>
                    <Input
                      value={teamPageConfig.kpis?.teleop?.key || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateTeamPage({
                          kpis: {
                            ...teamPageConfig.kpis,
                            auto: teamPageConfig.kpis?.auto || { key: "", label: "" },
                            teleop: { ...teamPageConfig.kpis?.teleop, label: teamPageConfig.kpis?.teleop?.label || "", key: val },
                          },
                        });
                      }}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Inspector for Scoring Breakdown Chart */}
            {selectedSection === "chart" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Chart Title</Label>
                  <Input
                    value={teamPageConfig.scoringBreakdownChart?.title || ""}
                    onChange={(e) =>
                      updateTeamPage({
                        scoringBreakdownChart: {
                          ...teamPageConfig.scoringBreakdownChart,
                          items: teamPageConfig.scoringBreakdownChart?.items || [],
                          title: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs">Chart Items & Colors</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {(teamPageConfig.scoringBreakdownChart?.items || []).map((item, idx) => (
                      <div key={idx} className="p-2 bg-muted/40 rounded-lg border space-y-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={item.fill || "#3b82f6"}
                            onChange={(e) => {
                              const val = e.target.value;
                              const items = [...(teamPageConfig.scoringBreakdownChart?.items || [])];
                              items[idx] = { ...items[idx], fill: val };
                              updateTeamPage({
                                scoringBreakdownChart: {
                                  ...teamPageConfig.scoringBreakdownChart,
                                  title: teamPageConfig.scoringBreakdownChart?.title || "Scoring Breakdown",
                                  items,
                                },
                              });
                            }}
                            className="w-7 h-7 rounded border cursor-pointer shrink-0"
                          />
                          <Input
                            value={item.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              const items = [...(teamPageConfig.scoringBreakdownChart?.items || [])];
                              items[idx] = { ...items[idx], name: val };
                              updateTeamPage({
                                scoringBreakdownChart: {
                                  ...teamPageConfig.scoringBreakdownChart,
                                  title: teamPageConfig.scoringBreakdownChart?.title || "Scoring Breakdown",
                                  items,
                                },
                              });
                            }}
                            className="h-7 text-xs font-semibold flex-1"
                            placeholder="Item Name"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleRemoveChartItem(idx)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          value={item.key}
                          onChange={(e) => {
                            const val = e.target.value;
                            const items = [...(teamPageConfig.scoringBreakdownChart?.items || [])];
                            items[idx] = { ...items[idx], key: val };
                            updateTeamPage({
                              scoringBreakdownChart: {
                                ...teamPageConfig.scoringBreakdownChart,
                                title: teamPageConfig.scoringBreakdownChart?.title || "Scoring Breakdown",
                                items,
                              },
                            });
                          }}
                          className="h-7 text-xs font-mono"
                          placeholder="Field Key (e.g. teleop.fuel_scored)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Inspector for Endgame */}
            {selectedSection === "endgame" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Endgame Title</Label>
                  <Input
                    value={teamPageConfig.endgame?.title || ""}
                    onChange={(e) =>
                      updateTeamPage({
                        endgame: {
                          ...teamPageConfig.endgame,
                          stateKey: teamPageConfig.endgame?.stateKey || "endgame.ending_robot_state",
                          states: teamPageConfig.endgame?.states || [],
                          title: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Robot State Field Key</Label>
                  <Input
                    value={teamPageConfig.endgame?.stateKey || "endgame.ending_robot_state"}
                    onChange={(e) =>
                      updateTeamPage({
                        endgame: {
                          ...teamPageConfig.endgame,
                          title: teamPageConfig.endgame?.title || "Endgame Distribution",
                          states: teamPageConfig.endgame?.states || [],
                          stateKey: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* Inspector for Penalties */}
            {selectedSection === "penalties" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Minor Foul Deductions (pts)</Label>
                  <Input
                    type="number"
                    value={teamPageConfig.penalties?.minorPoints ?? -3}
                    onChange={(e) =>
                      updateTeamPage({
                        penalties: {
                          ...teamPageConfig.penalties,
                          title: teamPageConfig.penalties?.title || "Penalties",
                          description: "",
                          minorKey: teamPageConfig.penalties?.minorKey || "fouls.fouls",
                          minorLabel: teamPageConfig.penalties?.minorLabel || "Minor Fouls",
                          majorKey: teamPageConfig.penalties?.majorKey || "fouls.tech_fouls",
                          majorLabel: teamPageConfig.penalties?.majorLabel || "Tech Fouls",
                          majorPoints: teamPageConfig.penalties?.majorPoints ?? -10,
                          minorPoints: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Major Foul Deductions (pts)</Label>
                  <Input
                    type="number"
                    value={teamPageConfig.penalties?.majorPoints ?? -10}
                    onChange={(e) =>
                      updateTeamPage({
                        penalties: {
                          ...teamPageConfig.penalties,
                          title: teamPageConfig.penalties?.title || "Penalties",
                          description: "",
                          minorKey: teamPageConfig.penalties?.minorKey || "fouls.fouls",
                          minorLabel: teamPageConfig.penalties?.minorLabel || "Minor Fouls",
                          majorKey: teamPageConfig.penalties?.majorKey || "fouls.tech_fouls",
                          majorLabel: teamPageConfig.penalties?.majorLabel || "Tech Fouls",
                          minorPoints: teamPageConfig.penalties?.minorPoints ?? -3,
                          majorPoints: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
