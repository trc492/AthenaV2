"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sliders,
  Trash2,
  Copy,
  X,
  Plus,
  Trophy,
  MapPin,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import type { YearConfig, ScoringDefinition } from "@/lib/types";
import { slugifyKey } from "./types";

export interface SelectedComponentInfo {
  mode: "match" | "pit";
  section: string;
  fieldKey: string;
}

interface PropertyInspectorProps {
  config: YearConfig;
  year: number;
  selectedComponent: SelectedComponentInfo | null;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
  onUpdateYear: (year: number) => void;
  onSelectComponent: (comp: SelectedComponentInfo | null) => void;
  onDuplicateComponent: (comp: SelectedComponentInfo) => void;
  onDeleteComponent: (comp: SelectedComponentInfo) => void;
}

export function PropertyInspector({
  config,
  year,
  selectedComponent,
  onUpdateConfig,
  onUpdateYear,
  onSelectComponent,
  onDuplicateComponent,
  onDeleteComponent,
}: PropertyInspectorProps) {
  const [newPosition, setNewPosition] = useState("");
  const [newIncrementInput, setNewIncrementInput] = useState("");
  const [newOptionInput, setNewOptionInput] = useState("");

  // Handler to add starting position
  const handleAddPosition = () => {
    const trimmed = newPosition.trim();
    if (!trimmed) return;
    const current = config.startPositions || [];
    if (!current.includes(trimmed)) {
      onUpdateConfig((prev) => ({
        ...prev,
        startPositions: [...(prev.startPositions || []), trimmed],
      }));
    }
    setNewPosition("");
  };

  const handleRemovePosition = (idx: number) => {
    onUpdateConfig((prev) => ({
      ...prev,
      startPositions: (prev.startPositions || []).filter((_, i) => i !== idx),
    }));
  };

  // If no component is selected, show Game & Canvas Settings
  if (!selectedComponent) {
    const totalMatchFields = Object.values(config.scoring || {}).reduce(
      (acc, sec) => acc + Object.keys(sec || {}).length,
      0,
    );
    const totalPitFields = Object.values(config.pitScouting || {}).reduce(
      (acc, sec) => acc + Object.keys(sec || {}).length,
      0,
    );

    return (
      <div className="w-full h-full flex flex-col bg-card/60 rounded-xl border border-border overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sliders className="h-3.5 w-3.5 text-primary" />
            Canvas Properties
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Configure global game attributes and start positions
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Game General Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              Game Season & Title
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Competition Program</Label>
              <Select
                value={config.competitionType || "FRC"}
                onValueChange={(val: "FRC" | "FTC") =>
                  onUpdateConfig((prev) => ({ ...prev, competitionType: val }))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRC">FRC (FIRST Robotics)</SelectItem>
                  <SelectItem value="FTC">FTC (FIRST Tech Challenge)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Year</Label>
                <Input
                  type="number"
                  value={year || ""}
                  onChange={(e) => onUpdateYear(parseInt(e.target.value, 10) || 0)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Game Name</Label>
                <Input
                  value={config.gameName || ""}
                  onChange={(e) =>
                    onUpdateConfig((prev) => ({ ...prev, gameName: e.target.value }))
                  }
                  className="h-8 text-xs"
                  placeholder="REEFSCAPE"
                />
              </div>
            </div>
          </div>

          {/* Starting Positions */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Field Starting Positions
            </div>

            <div className="flex gap-1.5">
              <Input
                placeholder="e.g. Left Trench, Center..."
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddPosition();
                  }
                }}
                className="h-8 text-xs flex-1"
              />
              <Button size="sm" variant="secondary" onClick={handleAddPosition} className="h-8 px-2.5 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {(config.startPositions || []).map((pos, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs px-2 py-0.5 flex items-center gap-1 bg-muted/40 border-border"
                >
                  <span>{pos}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePosition(idx)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-2 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              Configuration Summary
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <div className="p-2 rounded bg-muted/30 border">
                <span className="font-semibold text-foreground text-sm block">{totalMatchFields}</span>
                Match Scoring Fields
              </div>
              <div className="p-2 rounded bg-muted/30 border">
                <span className="font-semibold text-foreground text-sm block">{totalPitFields}</span>
                Pit Scouting Questions
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Select any component on the canvas to inspect and edit its live properties.</span>
          </div>
        </div>
      </div>
    );
  }

  // A component IS selected
  const { mode, section, fieldKey } = selectedComponent;

  if (mode === "match") {
    const sectionScoring = (config.scoring?.[section as keyof typeof config.scoring] || {}) as Record<string, ScoringDefinition>;
    const fieldDef = sectionScoring[fieldKey];

    if (!fieldDef) {
      return (
        <div className="p-4 text-xs text-muted-foreground">
          Component not found or deleted.
          <Button variant="link" size="sm" onClick={() => onSelectComponent(null)}>
            Deselect
          </Button>
        </div>
      );
    }

    const updateField = (patch: Partial<ScoringDefinition>) => {
      onUpdateConfig((prev) => {
        const scoring = { ...prev.scoring };
        const sec = { ...((scoring[section as keyof typeof scoring] || {}) as Record<string, ScoringDefinition>) };
        sec[fieldKey] = { ...sec[fieldKey], ...patch };
        return {
          ...prev,
          scoring: {
            ...scoring,
            [section]: sec,
          },
        };
      });
    };

    const handleKeyChange = (newKey: string) => {
      const sanitized = slugifyKey(newKey);
      if (!sanitized || sanitized === fieldKey) return;
      onUpdateConfig((prev) => {
        const scoring = { ...prev.scoring };
        const sec = { ...((scoring[section as keyof typeof scoring] || {}) as Record<string, ScoringDefinition>) };
        const existing = sec[fieldKey];
        delete sec[fieldKey];
        sec[sanitized] = existing;
        return {
          ...prev,
          scoring: {
            ...scoring,
            [section]: sec,
          },
        };
      });
      onSelectComponent({ mode, section, fieldKey: sanitized });
    };

    const isBool = fieldDef.type === "boolean";
    const isSelect = fieldDef.type === "select" || !!fieldDef.pointValues;
    const isCounter = !!fieldDef.increments && fieldDef.increments.length > 0;

    // Available boolean keys in the current section for "dependsOn"
    const availableDependencies = Object.entries(sectionScoring)
      .filter(([k, d]) => k !== fieldKey && d.type === "boolean")
      .map(([k, d]) => ({ key: k, label: d.label }));

    return (
      <div className="w-full h-full flex flex-col bg-card/60 rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] uppercase font-bold text-primary">
              {isBool ? "Toggle" : isSelect ? "Select" : isCounter ? "Stepper" : "Number"}
            </Badge>
            <span className="text-xs font-mono font-semibold truncate max-w-[120px]">{fieldKey}</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onDuplicateComponent(selectedComponent)}
              title="Duplicate Component"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteComponent(selectedComponent)}
              title="Delete Component"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onSelectComponent(null)}
              title="Close Inspector"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Live Properties */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Display Label */}
          <div className="space-y-1.5">
            <Label className="text-xs">Display Label</Label>
            <Input
              value={fieldDef.label}
              onChange={(e) => updateField({ label: e.target.value })}
              className="h-8 text-xs font-medium"
              placeholder="e.g. Fuel Scored (Auto)"
            />
          </div>

          {/* Identifier Key */}
          <div className="space-y-1.5">
            <Label className="text-xs">Field Key</Label>
            <Input
              defaultValue={fieldKey}
              key={fieldKey}
              onBlur={(e) => handleKeyChange(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder="e.g. fuel_scored"
            />
            <p className="text-[10px] text-muted-foreground">Unique identifier stored in match data records.</p>
          </div>

          {/* Points / Multiplier */}
          {!isSelect && (
            <div className="space-y-1.5">
              <Label className="text-xs">Points Value</Label>
              <Input
                type="number"
                value={fieldDef.points ?? 0}
                onChange={(e) => updateField({ points: parseFloat(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {isBool ? "Points awarded when achieved" : "Points awarded per count"}
              </p>
            </div>
          )}

          {/* Stepper Increments */}
          {isCounter && (
            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs">Stepper Increments</Label>
              <div className="flex flex-wrap gap-1">
                {(fieldDef.increments || []).map((inc, i) => (
                  <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5 flex items-center gap-1 font-mono">
                    +{inc}
                    <button
                      type="button"
                      onClick={() => {
                        const nextInc = (fieldDef.increments || []).filter((_, idx) => idx !== i);
                        updateField({ increments: nextInc.length > 0 ? nextInc : [1] });
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-1.5 mt-1">
                <Input
                  type="number"
                  placeholder="Step amount (e.g. 5)"
                  value={newIncrementInput}
                  onChange={(e) => setNewIncrementInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = parseInt(newIncrementInput, 10);
                      if (val > 0 && !(fieldDef.increments || []).includes(val)) {
                        updateField({ increments: [...(fieldDef.increments || []), val].sort((a, b) => a - b) });
                        setNewIncrementInput("");
                      }
                    }
                  }}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const val = parseInt(newIncrementInput, 10);
                    if (val > 0 && !(fieldDef.increments || []).includes(val)) {
                      updateField({ increments: [...(fieldDef.increments || []), val].sort((a, b) => a - b) });
                      setNewIncrementInput("");
                    }
                  }}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>
          )}

          {/* Select Options & Points */}
          {isSelect && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Option Point Values</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] text-primary"
                  onClick={() => {
                    const next = { ...(fieldDef.pointValues || {}) };
                    next[`option_${Object.keys(next).length + 1}`] = 0;
                    updateField({ pointValues: next });
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Option
                </Button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {Object.entries(fieldDef.pointValues || {}).map(([opt, pts], idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded border">
                    <Input
                      defaultValue={opt}
                      onBlur={(e) => {
                        const newName = e.target.value.trim();
                        if (newName && newName !== opt) {
                          const next: Record<string, number> = {};
                          Object.entries(fieldDef.pointValues || {}).forEach(([k, v]) => {
                            if (k === opt) next[newName] = v;
                            else next[k] = v;
                          });
                          updateField({ pointValues: next });
                        }
                      }}
                      className="h-7 text-xs flex-1"
                      placeholder="Option name"
                    />
                    <Input
                      type="number"
                      value={pts}
                      onChange={(e) => {
                        const next = { ...(fieldDef.pointValues || {}) };
                        next[opt] = parseFloat(e.target.value) || 0;
                        updateField({ pointValues: next });
                      }}
                      className="h-7 w-16 text-xs text-center font-mono"
                      placeholder="Pts"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        const next = { ...(fieldDef.pointValues || {}) };
                        delete next[opt];
                        updateField({ pointValues: next });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conditional Dependency */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label className="text-xs">Conditional Display (dependsOn)</Label>
            <Select
              value={fieldDef.dependsOn || "__none__"}
              onValueChange={(val) => updateField({ dependsOn: val === "__none__" ? undefined : val })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Always Visible" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Always Visible</SelectItem>
                {availableDependencies.map((dep) => (
                  <SelectItem key={dep.key} value={dep.key}>
                    Only if "{dep.label}" is Yes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Help Description */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label className="text-xs">Description / Scouter Instructions</Label>
            <Textarea
              value={fieldDef.description || ""}
              onChange={(e) => updateField({ description: e.target.value })}
              rows={2}
              className="text-xs"
              placeholder="Guidance for scouters during the match..."
            />
          </div>
        </div>
      </div>
    );
  }

  // Pit Scouting component selected
  const pitSection = (config.pitScouting?.[section as keyof typeof config.pitScouting] || {}) as Record<string, any>;
  const pitDef = pitSection[fieldKey];

  if (!pitDef) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Question not found.
        <Button variant="link" size="sm" onClick={() => onSelectComponent(null)}>
          Deselect
        </Button>
      </div>
    );
  }

  const updatePitField = (patch: Record<string, any>) => {
    onUpdateConfig((prev) => {
      const pit = { ...prev.pitScouting };
      const sec = { ...((pit[section as keyof typeof pit] || {}) as Record<string, any>) };
      sec[fieldKey] = { ...sec[fieldKey], ...patch };
      return {
        ...prev,
        pitScouting: {
          ...pit,
          [section]: sec,
        },
      };
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-card/60 rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] uppercase font-bold text-primary">
            {pitDef.type}
          </Badge>
          <span className="text-xs font-mono font-semibold truncate max-w-[120px]">{fieldKey}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteComponent(selectedComponent)}
            title="Delete Question"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => onSelectComponent(null)}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Question Label</Label>
          <Input
            value={pitDef.label}
            onChange={(e) => updatePitField({ label: e.target.value })}
            className="h-8 text-xs font-medium"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Field Key</Label>
          <Input
            defaultValue={fieldKey}
            key={fieldKey}
            onBlur={(e) => {
              const sanitized = slugifyKey(e.target.value);
              if (sanitized && sanitized !== fieldKey) {
                onUpdateConfig((prev) => {
                  const pit = { ...prev.pitScouting };
                  const sec = { ...((pit[section as keyof typeof pit] || {}) as Record<string, any>) };
                  const existing = sec[fieldKey];
                  delete sec[fieldKey];
                  sec[sanitized] = existing;
                  return { ...prev, pitScouting: { ...pit, [section]: sec } };
                });
                onSelectComponent({ mode, section, fieldKey: sanitized });
              }
            }}
            className="h-8 text-xs font-mono"
          />
        </div>

        {(pitDef.type === "select" || pitDef.type === "multiselect") && (
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs">Options List</Label>
            <div className="flex gap-1.5">
              <Input
                placeholder="New option..."
                value={newOptionInput}
                onChange={(e) => setNewOptionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = newOptionInput.trim();
                    if (trimmed && !(pitDef.options || []).includes(trimmed)) {
                      updatePitField({ options: [...(pitDef.options || []), trimmed] });
                      setNewOptionInput("");
                    }
                  }
                }}
                className="h-8 text-xs flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const trimmed = newOptionInput.trim();
                  if (trimmed && !(pitDef.options || []).includes(trimmed)) {
                    updatePitField({ options: [...(pitDef.options || []), trimmed] });
                    setNewOptionInput("");
                  }
                }}
                className="h-8 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {(pitDef.options || []).map((opt: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5 flex items-center gap-1">
                  <span>{opt}</span>
                  <button
                    type="button"
                    onClick={() => {
                      updatePitField({
                        options: (pitDef.options || []).filter((_: any, idx: number) => idx !== i),
                      });
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
