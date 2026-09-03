"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Award,
  AlertTriangle,
  ShieldAlert,
  Plus,
  Minus,
  Eye,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import type { YearConfig } from "@/lib/types";

interface BuilderLivePreviewProps {
  config: YearConfig;
}

export function BuilderLivePreview({ config }: BuilderLivePreviewProps) {
  const [previewMode, setPreviewMode] = useState<"match" | "pit">("match");
  const [matchTab, setMatchTab] = useState<"auto" | "teleop" | "endgame" | "fouls">("auto");
  const [matchData, setMatchData] = useState<Record<string, any>>({});
  const [pitData, setPitData] = useState<Record<string, any>>({});

  const handleReset = () => {
    setMatchData({});
    setPitData({});
  };

  const updateMatchField = (key: string, val: any) => {
    setMatchData((prev) => ({ ...prev, [key]: val }));
  };

  const updatePitField = (key: string, val: any) => {
    setPitData((prev) => ({ ...prev, [key]: val }));
  };

  const autoScoring = config.scoring?.autonomous || {};
  const teleopScoring = config.scoring?.teleop || {};
  const endgameScoring = config.scoring?.endgame || {};
  const foulsScoring = config.scoring?.fouls || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Interactive Live Form Preview</h3>
            <p className="text-xs text-muted-foreground">
              Test your configuration components directly before saving to disk.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            value={previewMode}
            onValueChange={(v) => setPreviewMode(v as "match" | "pit")}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="match" className="text-xs px-3">
                Match Scout Form
              </TabsTrigger>
              <TabsTrigger value="pit" className="text-xs px-3">
                Pit Scout Form
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" onClick={handleReset} title="Reset Form Inputs">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {previewMode === "match" ? (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  {config.competitionType} {config.gameName} Match Scouting
                </CardTitle>
                <CardDescription className="text-xs">
                  Simulated dynamic match scouting interface
                </CardDescription>
              </div>

              {/* Start Position Selector */}
              {config.startPositions && config.startPositions.length > 0 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Start Position:</Label>
                  <Select
                    value={matchData["startPosition"] || ""}
                    onValueChange={(val) => updateMatchField("startPosition", val)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.startPositions.map((pos, idx) => (
                        <SelectItem key={idx} value={pos}>
                          {pos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Tabs
              value={matchTab}
              onValueChange={(v) => setMatchTab(v as any)}
              className="w-full pt-2"
            >
              <TabsList className="grid grid-cols-4 w-full h-9">
                <TabsTrigger value="auto" className="flex items-center gap-1.5 text-xs">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Auto
                </TabsTrigger>
                <TabsTrigger value="teleop" className="flex items-center gap-1.5 text-xs">
                  <Award className="h-3.5 w-3.5 text-blue-500" /> Teleop
                </TabsTrigger>
                <TabsTrigger value="endgame" className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-purple-500" /> Endgame
                </TabsTrigger>
                <TabsTrigger value="fouls" className="flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Fouls
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {matchTab === "auto" &&
                renderScoringFields(autoScoring, matchData, updateMatchField)}
              {matchTab === "teleop" &&
                renderScoringFields(teleopScoring, matchData, updateMatchField)}
              {matchTab === "endgame" &&
                renderScoringFields(endgameScoring, matchData, updateMatchField)}
              {matchTab === "fouls" &&
                renderScoringFields(foulsScoring, matchData, updateMatchField)}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Pit Scouting Preview */
        <div className="space-y-6">
          {(["autonomous", "teleoperated", "driveTeam", "endgame"] as const).map((cat) => {
            const fields = (config.pitScouting?.[cat] || {}) as Record<string, any>;
            if (Object.keys(fields).length === 0) return null;

            const titleMap = {
              autonomous: "Autonomous Capabilities",
              teleoperated: "Teleoperated & Mechanical Specs",
              driveTeam: "Drive Team & Practice",
              endgame: "Endgame & Climb Specs",
            };

            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">{titleMap[cat]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(fields).map(([key, field]) => {
                      if (field.dependsOn && !pitData[field.dependsOn]) {
                        return null;
                      }

                      return (
                        <div key={key} className="space-y-2">
                          <Label className="text-sm font-medium">{field.label}</Label>

                          {field.type === "text" && (
                            <Input
                              value={pitData[key] || ""}
                              onChange={(e) => updatePitField(key, e.target.value)}
                              placeholder="Enter details..."
                            />
                          )}

                          {field.type === "number" && (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() =>
                                  updatePitField(key, Math.max(0, (pitData[key] || 0) - 1))
                                }
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                className="text-center"
                                value={pitData[key] ?? 0}
                                onChange={(e) =>
                                  updatePitField(key, parseFloat(e.target.value) || 0)
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => updatePitField(key, (pitData[key] || 0) + 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          )}

                          {field.type === "boolean" && (
                            <div className="flex items-center gap-3 pt-1">
                              <Switch
                                checked={!!pitData[key]}
                                onCheckedChange={(checked) => updatePitField(key, checked)}
                              />
                              <span className="text-sm text-muted-foreground">
                                {pitData[key] ? "Yes" : "No"}
                              </span>
                            </div>
                          )}

                          {field.type === "select" && (
                            <Select
                              value={pitData[key] || ""}
                              onValueChange={(val) => updatePitField(key, val)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select option" />
                              </SelectTrigger>
                              <SelectContent>
                                {(field.options || []).map((opt: string, i: number) => (
                                  <SelectItem key={i} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {field.type === "multiselect" && (
                            <div className="space-y-2 pt-1">
                              {(field.options || []).map((opt: string, i: number) => {
                                const selectedOpts: string[] = pitData[key] || [];
                                const isChecked = selectedOpts.includes(opt);
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`pit-${key}-${i}`}
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          updatePitField(key, [...selectedOpts, opt]);
                                        } else {
                                          updatePitField(
                                            key,
                                            selectedOpts.filter((o) => o !== opt),
                                          );
                                        }
                                      }}
                                    />
                                    <Label
                                      htmlFor={`pit-${key}-${i}`}
                                      className="text-xs font-normal cursor-pointer"
                                    >
                                      {opt}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderScoringFields(
  scoringRecord: Record<string, any>,
  data: Record<string, any>,
  onUpdate: (key: string, val: any) => void,
) {
  if (Object.keys(scoringRecord).length === 0) {
    return (
      <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
        No scoring components in this section.
      </div>
    );
  }

  return Object.entries(scoringRecord).map(([key, def]) => {
    if (def.dependsOn && !data[def.dependsOn]) {
      return null;
    }

    const isBool = def.type === "boolean";
    const isSelect = def.type === "select" || !!def.pointValues;
    const isCounter = !!def.increments && def.increments.length > 0;
    const currentVal = data[key];

    return (
      <div
        key={key}
        className="p-4 rounded-xl border bg-card/60 flex flex-col justify-between space-y-3 shadow-xs"
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">{def.label}</span>
            {def.points !== undefined && (
              <Badge variant="secondary" className="text-[11px] shrink-0">
                {def.points > 0 ? `+${def.points} pts` : `${def.points} pts`}
              </Badge>
            )}
          </div>
          {def.description && (
            <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
          )}
        </div>

        {/* Boolean Toggle */}
        {isBool && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-medium text-muted-foreground">
              {currentVal ? "Achieved" : "Not Achieved"}
            </span>
            <Switch
              checked={!!currentVal}
              onCheckedChange={(checked) => onUpdate(key, checked)}
            />
          </div>
        )}

        {/* Counter Stepper with Increments */}
        {isCounter && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-center gap-3 bg-muted/40 py-2 rounded-lg">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onUpdate(key, Math.max(0, (currentVal || 0) - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-bold font-mono w-12 text-center text-primary">
                {currentVal ?? 0}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onUpdate(key, (currentVal || 0) + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick increment buttons */}
            {(def.increments?.length || 0) > 1 && (
              <div className="flex gap-1.5 justify-center">
                {def.increments.map((inc: number) => (
                  <Button
                    key={inc}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="text-xs h-7 px-2.5"
                    onClick={() => onUpdate(key, (currentVal || 0) + inc)}
                  >
                    +{inc}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Option Select */}
        {isSelect && (
          <div className="pt-1">
            <Select value={currentVal || ""} onValueChange={(val) => onUpdate(key, val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                {def.pointValues ? (
                  Object.entries(def.pointValues).map(([opt, pts]) => (
                    <SelectItem key={opt} value={opt}>
                      {opt} ({pts as number} pts)
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="none">None (0 pts)</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  });
}
