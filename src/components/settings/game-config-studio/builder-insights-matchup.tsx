"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Swords,
  LayoutDashboard,
  Plus,
  Trash2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import type { YearConfig } from "@/lib/types";

interface BuilderInsightsMatchupProps {
  config: YearConfig;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
}

export function BuilderInsightsMatchup({
  config,
  onUpdateConfig,
}: BuilderInsightsMatchupProps) {
  const [activeTab, setActiveTab] = useState("insights");

  // Insights helper
  const insightsList = config.analysisInsights?.insights || [];

  const handleAddInsight = () => {
    const newInsight = {
      id: `insight_${Date.now()}`,
      title: "New Insight Metric",
      description: "Custom calculated analytical metric",
      ranking: "higher" as const,
      valueFormat: "percent" as const,
      rawLabel: "Metric / Match",
      calculation: {
        type: "booleanRate" as const,
        key: "endgame.robot_broke_down",
      },
    };

    onUpdateConfig((prev) => ({
      ...prev,
      analysisInsights: {
        ...prev.analysisInsights,
        insights: [...(prev.analysisInsights?.insights || []), newInsight],
      },
    }));
  };

  const handleRemoveInsight = (index: number) => {
    onUpdateConfig((prev) => ({
      ...prev,
      analysisInsights: {
        ...prev.analysisInsights,
        insights: (prev.analysisInsights?.insights || []).filter((_, i) => i !== index),
      },
    }));
  };

  // Add scoring breakdown chart item
  const handleAddChartItem = () => {
    const newItem = {
      name: "New Category",
      key: "autonomous.game_piece_scored",
      fill: "#3b82f6",
    };

    onUpdateConfig((prev) => {
      const tp = prev.teamPageConfig || {
        kpis: {
          auto: { key: "autonomous.game_piece_scored", label: "Auto Scored" },
          teleop: { key: "teleop.game_piece_scored", label: "Teleop Scored" },
        },
        autoPerformance: { metrics: [] },
        teleopPerformance: { metrics: [] },
        scoringBreakdownChart: { title: "Scoring Breakdown", description: "", items: [] },
        endgame: { title: "Endgame", description: "", stateKey: "", states: [] },
        penalties: {
          title: "Penalties",
          description: "",
          minorKey: "fouls.minor_fouls",
          minorLabel: "Minor",
          minorPoints: -3,
          majorKey: "fouls.tech_fouls",
          majorLabel: "Major",
          majorPoints: -10,
        },
      };

      const chart = tp.scoringBreakdownChart || {
        title: "Scoring Breakdown",
        description: "",
        items: [],
      };

      return {
        ...prev,
        teamPageConfig: {
          ...tp,
          scoringBreakdownChart: {
            ...chart,
            items: [...(chart.items || []), newItem],
          },
        },
      };
    });
  };

  const handleRemoveChartItem = (index: number) => {
    onUpdateConfig((prev) => {
      if (!prev.teamPageConfig?.scoringBreakdownChart) return prev;
      return {
        ...prev,
        teamPageConfig: {
          ...prev.teamPageConfig,
          scoringBreakdownChart: {
            ...prev.teamPageConfig.scoringBreakdownChart,
            items: prev.teamPageConfig.scoringBreakdownChart.items.filter((_, i) => i !== index),
          },
        },
      };
    });
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full sm:w-auto h-auto p-1">
          <TabsTrigger value="insights" className="flex items-center gap-1.5 py-1.5 px-3">
            <TrendingUp className="h-4 w-4" />
            <span>Analysis Insights</span>
          </TabsTrigger>
          <TabsTrigger value="matchup" className="flex items-center gap-1.5 py-1.5 px-3">
            <Swords className="h-4 w-4" />
            <span>Match Matchup Card</span>
          </TabsTrigger>
          <TabsTrigger value="teampage" className="flex items-center gap-1.5 py-1.5 px-3">
            <LayoutDashboard className="h-4 w-4" />
            <span>Team Profile Page</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Analysis Insights */}
        <TabsContent value="insights" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Analytical Insights</h3>
              <p className="text-xs text-muted-foreground">
                Define computed analytical metrics for team ranking and consistency evaluation.
              </p>
            </div>
            <Button size="sm" onClick={handleAddInsight}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Insight Metric
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {insightsList.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No analysis insights configured. Click "Add Insight Metric" to add one.
                </CardContent>
              </Card>
            ) : (
              insightsList.map((insight, idx) => (
                <Card key={idx} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                      <div className="space-y-1">
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={insight.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdateConfig((prev) => {
                              const list = [...(prev.analysisInsights?.insights || [])];
                              list[idx] = { ...list[idx], title: val };
                              return { ...prev, analysisInsights: { ...prev.analysisInsights, insights: list } };
                            });
                          }}
                          placeholder="Insight Title"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Ranking Preference</Label>
                        <Select
                          value={insight.ranking}
                          onValueChange={(val: "higher" | "lower") => {
                            onUpdateConfig((prev) => {
                              const list = [...(prev.analysisInsights?.insights || [])];
                              list[idx] = { ...list[idx], ranking: val };
                              return { ...prev, analysisInsights: { ...prev.analysisInsights, insights: list } };
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="higher">Higher is Better (e.g. Scored)</SelectItem>
                            <SelectItem value="lower">Lower is Better (e.g. Breakdowns, Misses)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Value Format</Label>
                        <Select
                          value={insight.valueFormat || "percent"}
                          onValueChange={(val: "percent" | "number") => {
                            onUpdateConfig((prev) => {
                              const list = [...(prev.analysisInsights?.insights || [])];
                              list[idx] = { ...list[idx], valueFormat: val };
                              return { ...prev, analysisInsights: { ...prev.analysisInsights, insights: list } };
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Percentage (%)</SelectItem>
                            <SelectItem value="number">Integer Count</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveInsight(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/50">
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={insight.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((prev) => {
                            const list = [...(prev.analysisInsights?.insights || [])];
                            list[idx] = { ...list[idx], description: val };
                            return { ...prev, analysisInsights: { ...prev.analysisInsights, insights: list } };
                          });
                        }}
                        placeholder="Description of the metric"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Target Field Key (or comma-separated keys)</Label>
                      <Input
                        value={
                          insight.calculation.type === "booleanRate"
                            ? insight.calculation.key
                            : insight.calculation.type === "sum"
                              ? insight.calculation.keys.join(", ")
                              : insight.calculation.numeratorKeys.join(", ")
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((prev) => {
                            const list = [...(prev.analysisInsights?.insights || [])];
                            const currentCalc = list[idx].calculation;
                            let updatedCalc: typeof currentCalc;
                            if (currentCalc.type === "booleanRate") {
                              updatedCalc = { type: "booleanRate", key: val };
                            } else if (currentCalc.type === "sum") {
                              updatedCalc = {
                                type: "sum",
                                keys: val.split(",").map((k) => k.trim()).filter(Boolean),
                              };
                            } else {
                              updatedCalc = {
                                ...currentCalc,
                                numeratorKeys: val.split(",").map((k) => k.trim()).filter(Boolean),
                              };
                            }
                            list[idx] = { ...list[idx], calculation: updatedCalc };
                            return { ...prev, analysisInsights: { ...prev.analysisInsights, insights: list } };
                          });
                        }}
                        placeholder="e.g. endgame.robot_broke_down"
                      />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Match Matchup Card */}
        <TabsContent value="matchup" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Match Matchup Card Settings</CardTitle>
              <CardDescription>
                Configure warning thresholds and key display settings on the alliance match preview card.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="breakdown-thresh">Breakdown Alert Threshold (%)</Label>
                  <Input
                    id="breakdown-thresh"
                    type="number"
                    value={config.matchupCardConfig?.warnings?.breakdownThreshold ?? 15}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateConfig((prev) => ({
                        ...prev,
                        matchupCardConfig: {
                          ...prev.matchupCardConfig,
                          autoMetrics: prev.matchupCardConfig?.autoMetrics || [],
                          teleopMetrics: prev.matchupCardConfig?.teleopMetrics || [],
                          endgame: prev.matchupCardConfig?.endgame || { states: [] },
                          warnings: {
                            ...prev.matchupCardConfig?.warnings,
                            breakdownThreshold: val,
                          },
                        },
                      }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="foul-thresh">Foul Alert Threshold (per match)</Label>
                  <Input
                    id="foul-thresh"
                    type="number"
                    step="0.1"
                    value={config.matchupCardConfig?.warnings?.foulThreshold ?? 1.0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      onUpdateConfig((prev) => ({
                        ...prev,
                        matchupCardConfig: {
                          ...prev.matchupCardConfig,
                          autoMetrics: prev.matchupCardConfig?.autoMetrics || [],
                          teleopMetrics: prev.matchupCardConfig?.teleopMetrics || [],
                          endgame: prev.matchupCardConfig?.endgame || { states: [] },
                          warnings: {
                            ...prev.matchupCardConfig?.warnings,
                            foulThreshold: val,
                          },
                        },
                      }));
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endgame-state-key">Endgame State Field Key</Label>
                  <Input
                    id="endgame-state-key"
                    value={config.matchupCardConfig?.endgame?.stateKey || "endgame.ending_robot_state"}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateConfig((prev) => ({
                        ...prev,
                        matchupCardConfig: {
                          ...prev.matchupCardConfig,
                          autoMetrics: prev.matchupCardConfig?.autoMetrics || [],
                          teleopMetrics: prev.matchupCardConfig?.teleopMetrics || [],
                          endgame: {
                            ...prev.matchupCardConfig?.endgame,
                            stateKey: val,
                            states: prev.matchupCardConfig?.endgame?.states || [],
                          },
                        },
                      }));
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Team Page Config */}
        <TabsContent value="teampage" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Page KPIs</CardTitle>
              <CardDescription>
                Primary KPI cards shown at the top of individual team profile pages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg space-y-3 bg-muted/20">
                  <span className="font-semibold text-sm text-primary">Autonomous Primary KPI</span>
                  <div className="space-y-2">
                    <Label className="text-xs">Metric Key</Label>
                    <Input
                      value={config.teamPageConfig?.kpis?.auto?.key || "autonomous.fuel_scored"}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((prev) => ({
                          ...prev,
                          teamPageConfig: {
                            ...prev.teamPageConfig!,
                            kpis: {
                              ...prev.teamPageConfig?.kpis,
                              auto: { ...prev.teamPageConfig?.kpis?.auto, key: val, label: prev.teamPageConfig?.kpis?.auto?.label || "Auto KPI" },
                              teleop: prev.teamPageConfig?.kpis?.teleop || { key: "", label: "" },
                            },
                          },
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Display Label</Label>
                    <Input
                      value={config.teamPageConfig?.kpis?.auto?.label || "Avg Auto Scored"}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((prev) => ({
                          ...prev,
                          teamPageConfig: {
                            ...prev.teamPageConfig!,
                            kpis: {
                              ...prev.teamPageConfig?.kpis,
                              auto: { ...prev.teamPageConfig?.kpis?.auto, key: prev.teamPageConfig?.kpis?.auto?.key || "", label: val },
                              teleop: prev.teamPageConfig?.kpis?.teleop || { key: "", label: "" },
                            },
                          },
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 border rounded-lg space-y-3 bg-muted/20">
                  <span className="font-semibold text-sm text-primary">Teleoperated Primary KPI</span>
                  <div className="space-y-2">
                    <Label className="text-xs">Metric Key</Label>
                    <Input
                      value={config.teamPageConfig?.kpis?.teleop?.key || "teleop.fuel_scored"}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((prev) => ({
                          ...prev,
                          teamPageConfig: {
                            ...prev.teamPageConfig!,
                            kpis: {
                              ...prev.teamPageConfig?.kpis,
                              auto: prev.teamPageConfig?.kpis?.auto || { key: "", label: "" },
                              teleop: { ...prev.teamPageConfig?.kpis?.teleop, key: val, label: prev.teamPageConfig?.kpis?.teleop?.label || "Teleop KPI" },
                            },
                          },
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Display Label</Label>
                    <Input
                      value={config.teamPageConfig?.kpis?.teleop?.label || "Avg Teleop Scored"}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((prev) => ({
                          ...prev,
                          teamPageConfig: {
                            ...prev.teamPageConfig!,
                            kpis: {
                              ...prev.teamPageConfig?.kpis,
                              auto: prev.teamPageConfig?.kpis?.auto || { key: "", label: "" },
                              teleop: { ...prev.teamPageConfig?.kpis?.teleop, key: prev.teamPageConfig?.kpis?.teleop?.key || "", label: val },
                            },
                          },
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scoring Breakdown Chart Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Scoring Breakdown Chart Items
                  </CardTitle>
                  <CardDescription>
                    Bar chart items and custom color fills for team scoring breakdown.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={handleAddChartItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Chart Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(config.teamPageConfig?.scoringBreakdownChart?.items || []).map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-card p-2 rounded-md border">
                    <Input
                      placeholder="Item Name"
                      value={item.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((prev) => {
                          const items = [...(prev.teamPageConfig?.scoringBreakdownChart?.items || [])];
                          items[idx] = { ...items[idx], name: val };
                          return {
                            ...prev,
                            teamPageConfig: {
                              ...prev.teamPageConfig!,
                              scoringBreakdownChart: {
                                ...prev.teamPageConfig?.scoringBreakdownChart!,
                                items,
                              },
                            },
                          };
                        });
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Field Key"
                      value={item.key}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((prev) => {
                          const items = [...(prev.teamPageConfig?.scoringBreakdownChart?.items || [])];
                          items[idx] = { ...items[idx], key: val };
                          return {
                            ...prev,
                            teamPageConfig: {
                              ...prev.teamPageConfig!,
                              scoringBreakdownChart: {
                                ...prev.teamPageConfig?.scoringBreakdownChart!,
                                items,
                              },
                            },
                          };
                        });
                      }}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="color"
                        value={item.fill || "#3b82f6"}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((prev) => {
                            const items = [...(prev.teamPageConfig?.scoringBreakdownChart?.items || [])];
                            items[idx] = { ...items[idx], fill: val };
                            return {
                              ...prev,
                              teamPageConfig: {
                                ...prev.teamPageConfig!,
                                scoringBreakdownChart: {
                                  ...prev.teamPageConfig?.scoringBreakdownChart!,
                                  items,
                                },
                              },
                            };
                          });
                        }}
                        className="w-8 h-8 rounded border cursor-pointer"
                        title="Choose bar color"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => handleRemoveChartItem(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
