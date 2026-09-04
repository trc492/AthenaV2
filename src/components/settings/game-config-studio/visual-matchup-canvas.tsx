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
  Swords,
  Flame,
  Zap,
  Target,
  Activity,
  Sparkles,
  Package,
  Puzzle,
  AlertTriangle,
  Plus,
  Trash2,
  Sliders,
  Check,
  HelpCircle,
} from "lucide-react";
import type { YearConfig, MetricDisplayConfig, MatchupCardConfig } from "@/lib/types";

interface VisualMatchupCanvasProps {
  config: YearConfig;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
}

// Icon helper
function getIconComponent(iconName?: string) {
  const className = "h-4 w-4";
  switch (iconName?.toLowerCase()) {
    case "flame":
      return <Flame className={`${className} text-amber-500`} />;
    case "zap":
      return <Zap className={`${className} text-yellow-500`} />;
    case "target":
      return <Target className={`${className} text-emerald-500`} />;
    case "activity":
      return <Activity className={`${className} text-blue-500`} />;
    case "package":
      return <Package className={`${className} text-purple-500`} />;
    case "puzzle":
      return <Puzzle className={`${className} text-pink-500`} />;
    default:
      return <Sparkles className={`${className} text-primary`} />;
  }
}

export function VisualMatchupCanvas({
  config,
  onUpdateConfig,
}: VisualMatchupCanvasProps) {
  const [allianceColor, setAllianceColor] = useState<"red" | "blue">("blue");
  const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);

  const matchupConfig: MatchupCardConfig = config.matchupCardConfig || {
    autoIcon: "Flame",
    autoMetrics: [{ key: "autonomous.fuel_scored", label: "Avg Fuel" }],
    teleopIcon: "Flame",
    teleopMetrics: [{ key: "teleop.fuel_scored", label: "Fuel Scored" }],
    endgame: {
      stateKey: "endgame.ending_robot_state",
      states: [
        { key: "L3", label: "L3 Rate" },
        { key: "L2", label: "L2 Rate" },
        { key: "L1", label: "L1 Rate" },
      ],
    },
    warnings: {
      breakdownThreshold: 15,
      foulThreshold: 1.0,
      techFoulThreshold: 0.5,
    },
    pitHighlights: [
      { section: "endgame", field: "climbCapability", label: "Climb" },
      { section: "teleoperated", field: "intakeType", label: "Intake" },
    ],
  };

  const updateMatchup = (patch: Partial<MatchupCardConfig>) => {
    onUpdateConfig((prev) => ({
      ...prev,
      matchupCardConfig: {
        ...(prev.matchupCardConfig || matchupConfig),
        ...patch,
      },
    }));
  };

  // Add a new metric to Auto or Teleop
  const handleAddMetric = (section: "auto" | "teleop") => {
    const newMetric: MetricDisplayConfig = {
      key: section === "auto" ? "autonomous.new_metric" : "teleop.new_metric",
      label: section === "auto" ? "New Auto Metric" : "New Teleop Metric",
      type: "number",
    };

    if (section === "auto") {
      updateMatchup({
        autoMetrics: [...(matchupConfig.autoMetrics || []), newMetric],
      });
    } else {
      updateMatchup({
        teleopMetrics: [...(matchupConfig.teleopMetrics || []), newMetric],
      });
    }
    setSelectedMetricKey(newMetric.key);
  };

  // Remove a metric
  const handleRemoveMetric = (section: "auto" | "teleop", keyToRemove: string) => {
    if (section === "auto") {
      updateMatchup({
        autoMetrics: (matchupConfig.autoMetrics || []).filter((m) => m.key !== keyToRemove),
      });
    } else {
      updateMatchup({
        teleopMetrics: (matchupConfig.teleopMetrics || []).filter((m) => m.key !== keyToRemove),
      });
    }
    if (selectedMetricKey === keyToRemove) setSelectedMetricKey(null);
  };

  // Add Pit Highlight
  const handleAddPitHighlight = () => {
    const newHighlight = {
      section: "teleoperated" as const,
      field: "intakeType",
      label: "New Highlight",
    };
    updateMatchup({
      pitHighlights: [...(matchupConfig.pitHighlights || []), newHighlight],
    });
  };

  // Find currently selected metric
  const currentMetric =
    matchupConfig.autoMetrics?.find((m) => m.key === selectedMetricKey) ||
    matchupConfig.teleopMetrics?.find((m) => m.key === selectedMetricKey);

  const updateSelectedMetric = (patch: Partial<MetricDisplayConfig>) => {
    if (!selectedMetricKey) return;
    const isAuto = matchupConfig.autoMetrics?.some((m) => m.key === selectedMetricKey);

    if (isAuto) {
      updateMatchup({
        autoMetrics: (matchupConfig.autoMetrics || []).map((m) =>
          m.key === selectedMetricKey ? { ...m, ...patch } : m,
        ),
      });
    } else {
      updateMatchup({
        teleopMetrics: (matchupConfig.teleopMetrics || []).map((m) =>
          m.key === selectedMetricKey ? { ...m, ...patch } : m,
        ),
      });
    }

    if (patch.key && patch.key !== selectedMetricKey) {
      setSelectedMetricKey(patch.key);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Control Column (3 cols) */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <Swords className="h-4 w-4 text-primary" />
              Matchup Card Designer
            </CardTitle>
            <CardDescription className="text-xs">
              Configure how robot metrics appear on the alliance matchup comparison screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Alliance Preview Color</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={allianceColor === "blue" ? "default" : "outline"}
                  onClick={() => setAllianceColor("blue")}
                  className={`text-xs ${allianceColor === "blue" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                >
                  Blue Alliance
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={allianceColor === "red" ? "default" : "outline"}
                  onClick={() => setAllianceColor("red")}
                  className={`text-xs ${allianceColor === "red" ? "bg-red-600 hover:bg-red-700" : ""}`}
                >
                  Red Alliance
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Add Elements
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => handleAddMetric("auto")}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> Add Auto Metric
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => handleAddMetric("teleop")}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-blue-500" /> Add Teleop Metric
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={handleAddPitHighlight}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Add Pit Highlight Badge
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Global Matchup Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Alerts & Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Breakdown Alert Threshold (%)</Label>
              <Input
                type="number"
                value={matchupConfig.warnings?.breakdownThreshold ?? 15}
                onChange={(e) =>
                  updateMatchup({
                    warnings: {
                      ...matchupConfig.warnings,
                      breakdownThreshold: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Foul Alert Threshold (per match)</Label>
              <Input
                type="number"
                step="0.1"
                value={matchupConfig.warnings?.foulThreshold ?? 1.0}
                onChange={(e) =>
                  updateMatchup({
                    warnings: {
                      ...matchupConfig.warnings,
                      foulThreshold: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tech Foul Alert Threshold</Label>
              <Input
                type="number"
                step="0.1"
                value={matchupConfig.warnings?.techFoulThreshold ?? 0.5}
                onChange={(e) =>
                  updateMatchup({
                    warnings: {
                      ...matchupConfig.warnings,
                      techFoulThreshold: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="h-8 text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center Live WYSIWYG Card Preview (6 cols) */}
      <div className="lg:col-span-6 flex flex-col items-center">
        <span className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Live Matchup Card Preview (Click any metric to edit)
        </span>

        {/* The Exact Matchup Card Component Layout */}
        <div
          className={`w-full max-w-lg rounded-xl border-2 bg-card shadow-xl overflow-hidden transition-all ${
            allianceColor === "red" ? "border-l-8 border-l-red-500" : "border-l-8 border-l-blue-500"
          }`}
        >
          {/* Card Header */}
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight">Team 492</span>
                <span className="text-xs font-semibold text-muted-foreground">Titan Robotics Club</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                  Rank #3
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  EPA: 48.2
                </Badge>
              </div>
            </div>

            {/* Warning Badges Simulation */}
            <div className="flex flex-col gap-1 items-end">
              <Badge variant="destructive" className="text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5">
                <AlertTriangle className="h-3 w-3" /> Breakdown {matchupConfig.warnings?.breakdownThreshold ?? 15}%
              </Badge>
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
                Fouls: {(matchupConfig.warnings?.foulThreshold ?? 1.0).toFixed(1)}/match
              </Badge>
            </div>
          </div>

          {/* Card Body Metrics */}
          <div className="p-4 space-y-4">
            {/* Auto Metrics Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  {getIconComponent(matchupConfig.autoIcon)}
                  Autonomous Metrics
                </span>
                <Select
                  value={matchupConfig.autoIcon || "Flame"}
                  onValueChange={(icon) => updateMatchup({ autoIcon: icon })}
                >
                  <SelectTrigger className="h-6 text-[10px] w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flame">Flame</SelectItem>
                    <SelectItem value="Zap">Zap</SelectItem>
                    <SelectItem value="Target">Target</SelectItem>
                    <SelectItem value="Activity">Activity</SelectItem>
                    <SelectItem value="Sparkles">Sparkles</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(matchupConfig.autoMetrics || []).map((metric) => {
                  const isSelected = selectedMetricKey === metric.key;
                  return (
                    <div
                      key={metric.key}
                      onClick={() => setSelectedMetricKey(metric.key)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "ring-2 ring-primary border-primary bg-primary/10 shadow-sm"
                          : "bg-muted/40 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground truncate">{metric.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMetric("auto", metric.key);
                          }}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-base font-bold font-mono text-foreground">14.2</span>
                        {metric.unit && <span className="text-[10px] text-muted-foreground">{metric.unit}</span>}
                        {metric.type === "badge" && (
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            Badge
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teleop Metrics Section */}
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  {getIconComponent(matchupConfig.teleopIcon)}
                  Teleoperated Metrics
                </span>
                <Select
                  value={matchupConfig.teleopIcon || "Flame"}
                  onValueChange={(icon) => updateMatchup({ teleopIcon: icon })}
                >
                  <SelectTrigger className="h-6 text-[10px] w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Flame">Flame</SelectItem>
                    <SelectItem value="Zap">Zap</SelectItem>
                    <SelectItem value="Target">Target</SelectItem>
                    <SelectItem value="Activity">Activity</SelectItem>
                    <SelectItem value="Sparkles">Sparkles</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(matchupConfig.teleopMetrics || []).map((metric) => {
                  const isSelected = selectedMetricKey === metric.key;
                  return (
                    <div
                      key={metric.key}
                      onClick={() => setSelectedMetricKey(metric.key)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "ring-2 ring-primary border-primary bg-primary/10 shadow-sm"
                          : "bg-muted/40 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground truncate">{metric.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMetric("teleop", metric.key);
                          }}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-base font-bold font-mono text-foreground">22.8</span>
                        {metric.unit && <span className="text-[10px] text-muted-foreground">{metric.unit}</span>}
                        {metric.type === "badge" && (
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            Badge
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Endgame Rates Simulation */}
            <div className="space-y-1.5 pt-2 border-t">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Endgame Success Rates
              </span>
              <div className="flex gap-2">
                {(matchupConfig.endgame?.states || []).map((st) => (
                  <div key={st.key} className="flex-1 p-2 bg-muted/30 rounded-lg border text-center">
                    <span className="text-[10px] text-muted-foreground block truncate">{st.label}</span>
                    <span className="text-xs font-mono font-bold text-primary">85%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pit Highlights Simulation */}
            {(matchupConfig.pitHighlights || []).length > 0 && (
              <div className="space-y-1.5 pt-2 border-t">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pit Highlights
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(matchupConfig.pitHighlights || []).map((ph, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5 bg-muted/40">
                      <span className="text-muted-foreground mr-1">{ph.label}:</span>
                      <span className="font-semibold text-foreground">Swerve</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Inspector Column (3 cols) */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Metric Property Inspector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentMetric ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Display Label</Label>
                  <Input
                    value={currentMetric.label}
                    onChange={(e) => updateSelectedMetric({ label: e.target.value })}
                    className="h-8 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Field Key</Label>
                  <Input
                    value={currentMetric.key}
                    onChange={(e) => updateSelectedMetric({ key: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Display Style</Label>
                  <Select
                    value={currentMetric.type || "number"}
                    onValueChange={(val: "number" | "rate" | "badge") =>
                      updateSelectedMetric({ type: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Numeric Average</SelectItem>
                      <SelectItem value="rate">Percentage Rate (%)</SelectItem>
                      <SelectItem value="badge">Badge Pill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Unit (e.g. % or s)</Label>
                    <Input
                      value={currentMetric.unit || ""}
                      onChange={(e) => updateSelectedMetric({ unit: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="%"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Threshold</Label>
                    <Input
                      type="number"
                      value={currentMetric.threshold ?? ""}
                      onChange={(e) =>
                        updateSelectedMetric({ threshold: parseFloat(e.target.value) || undefined })
                      }
                      className="h-8 text-xs"
                      placeholder="50"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Click any metric card on the center matchup preview to inspect and customize its settings.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
