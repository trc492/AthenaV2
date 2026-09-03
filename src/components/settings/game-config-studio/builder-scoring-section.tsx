"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  Award,
  AlertTriangle,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Hash,
  ToggleLeft,
  ListFilter,
} from "lucide-react";
import type { YearConfig, ScoringDefinition } from "@/lib/types";
import { slugifyKey } from "./types";

interface BuilderScoringSectionProps {
  config: YearConfig;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
}

type ScoringCategory = "autonomous" | "teleop" | "endgame" | "fouls";

interface EditingItem {
  section: ScoringCategory;
  originalKey?: string;
  key: string;
  label: string;
  description: string;
  componentType: "counter" | "boolean" | "select" | "number";
  points: number;
  incrementsStr: string;
  pointValues: { optionKey: string; points: number }[];
  dependsOn: string;
}

export function BuilderScoringSection({
  config,
  onUpdateConfig,
}: BuilderScoringSectionProps) {
  const [activeSection, setActiveSection] = useState<ScoringCategory>("autonomous");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);

  const sectionsConfig = config.scoring || {
    autonomous: {},
    teleop: {},
    endgame: {},
    fouls: {},
  };

  const currentSectionItems = sectionsConfig[activeSection] || {};

  const handleOpenAdd = () => {
    setEditingItem({
      section: activeSection,
      key: "",
      label: "",
      description: "",
      componentType: "counter",
      points: 1,
      incrementsStr: "1, 5, 10",
      pointValues: [
        { optionKey: "none", points: 0 },
        { optionKey: "low", points: 2 },
        { optionKey: "high", points: 5 },
      ],
      dependsOn: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (fieldKey: string, def: ScoringDefinition) => {
    let compType: "counter" | "boolean" | "select" | "number" = "counter";
    if (def.type === "boolean") compType = "boolean";
    else if (def.type === "select" || def.pointValues) compType = "select";
    else if (def.type === "number") compType = "number";
    else if (def.increments && def.increments.length > 0) compType = "counter";

    const pvList = def.pointValues
      ? Object.entries(def.pointValues).map(([optionKey, points]) => ({
          optionKey,
          points,
        }))
      : [
          { optionKey: "none", points: 0 },
          { optionKey: "L1", points: 10 },
          { optionKey: "L2", points: 20 },
        ];

    setEditingItem({
      section: activeSection,
      originalKey: fieldKey,
      key: fieldKey,
      label: def.label || "",
      description: def.description || "",
      componentType: compType,
      points: def.points ?? 1,
      incrementsStr: (def.increments || [1, 5, 10]).join(", "),
      pointValues: pvList,
      dependsOn: def.dependsOn || "",
    });
    setIsDialogOpen(true);
  };

  const handleDuplicate = (fieldKey: string, def: ScoringDefinition) => {
    const newKey = `${fieldKey}_copy`;
    onUpdateConfig((prev) => {
      const scoring = { ...prev.scoring };
      const sec = { ...(scoring[activeSection] || {}) };
      sec[newKey] = {
        ...def,
        label: `${def.label} (Copy)`,
      };
      return {
        ...prev,
        scoring: {
          ...scoring,
          [activeSection]: sec,
        },
      };
    });
  };

  const handleDelete = (fieldKey: string) => {
    onUpdateConfig((prev) => {
      const scoring = { ...prev.scoring };
      const sec = { ...(scoring[activeSection] || {}) };
      delete sec[fieldKey];
      return {
        ...prev,
        scoring: {
          ...scoring,
          [activeSection]: sec,
        },
      };
    });
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    const finalKey = editingItem.key.trim() || slugifyKey(editingItem.label) || "field";

    const def: ScoringDefinition = {
      label: editingItem.label || finalKey,
      description: editingItem.description,
    };

    if (editingItem.dependsOn.trim()) {
      def.dependsOn = editingItem.dependsOn.trim();
    }

    if (editingItem.componentType === "boolean") {
      def.type = "boolean";
      def.points = editingItem.points;
    } else if (editingItem.componentType === "select") {
      def.type = "select";
      const pvMap: Record<string, number> = {};
      editingItem.pointValues.forEach((pv) => {
        if (pv.optionKey.trim()) {
          pvMap[pv.optionKey.trim()] = Number(pv.points) || 0;
        }
      });
      def.pointValues = pvMap;
    } else if (editingItem.componentType === "counter") {
      def.points = Number(editingItem.points) || 0;
      const parsedInc = editingItem.incrementsStr
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
      def.increments = parsedInc.length > 0 ? parsedInc : [1];
    } else {
      def.type = "number";
      def.points = Number(editingItem.points) || 0;
    }

    onUpdateConfig((prev) => {
      const scoring = { ...prev.scoring };
      const sec = { ...(scoring[activeSection] || {}) };

      // If key changed during edit, delete old key
      if (editingItem.originalKey && editingItem.originalKey !== finalKey) {
        delete sec[editingItem.originalKey];
      }

      sec[finalKey] = def;

      return {
        ...prev,
        scoring: {
          ...scoring,
          [activeSection]: sec,
        },
      };
    });

    setIsDialogOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs
          value={activeSection}
          onValueChange={(val) => setActiveSection(val as ScoringCategory)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto h-auto p-1">
            <TabsTrigger value="autonomous" className="flex items-center gap-1.5 py-1.5 px-3">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Auto</span>
            </TabsTrigger>
            <TabsTrigger value="teleop" className="flex items-center gap-1.5 py-1.5 px-3">
              <Award className="h-4 w-4 text-blue-500" />
              <span>Teleop</span>
            </TabsTrigger>
            <TabsTrigger value="endgame" className="flex items-center gap-1.5 py-1.5 px-3">
              <AlertTriangle className="h-4 w-4 text-purple-500" />
              <span>Endgame</span>
            </TabsTrigger>
            <TabsTrigger value="fouls" className="flex items-center gap-1.5 py-1.5 px-3">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              <span>Fouls</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button onClick={handleOpenAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Scoring Component
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(currentSectionItems).length === 0 ? (
          <div className="col-span-full border-2 border-dashed border-border rounded-xl p-8 text-center bg-card/40">
            <p className="text-muted-foreground mb-3">
              No scoring components defined in {activeSection}.
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-1.5" /> Add First Component
            </Button>
          </div>
        ) : (
          Object.entries(currentSectionItems).map(([key, def]) => {
            const isBool = def.type === "boolean";
            const isSelect = def.type === "select" || !!def.pointValues;
            const isCounter = !!def.increments && def.increments.length > 0;

            return (
              <Card key={key} className="relative group hover:border-primary/50 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">{def.label}</CardTitle>
                      <Badge variant="secondary" className="font-mono text-xs text-muted-foreground">
                        {key}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleDuplicate(key, def)}
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenEdit(key, def)}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(key)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {def.description && (
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {def.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0 text-xs space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {isBool && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1">
                        <ToggleLeft className="h-3 w-3" /> Toggle ({def.points ?? 0} pts)
                      </Badge>
                    )}
                    {isCounter && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Stepper [{(def.increments || []).join(", ")}] ({def.points ?? 0} pts)
                      </Badge>
                    )}
                    {isSelect && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1">
                        <ListFilter className="h-3 w-3" /> Select Dropdown
                      </Badge>
                    )}
                    {def.dependsOn && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                        Depends on: {def.dependsOn}
                      </Badge>
                    )}
                  </div>

                  {isSelect && def.pointValues && (
                    <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                      {Object.entries(def.pointValues).map(([opt, pts]) => (
                        <div key={opt} className="flex justify-between bg-muted/30 px-1.5 py-0.5 rounded">
                          <span className="font-medium truncate">{opt}:</span>
                          <span className="text-primary font-mono">{pts} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.originalKey ? "Edit Scoring Component" : "Add Scoring Component"}
            </DialogTitle>
            <DialogDescription>
              Configure the scoring input for {activeSection} match scouting.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="comp-type-select">Component Input Type</Label>
                <Select
                  value={editingItem.componentType}
                  onValueChange={(val: "counter" | "boolean" | "select" | "number") =>
                    setEditingItem((prev) => (prev ? { ...prev, componentType: val } : null))
                  }
                >
                  <SelectTrigger id="comp-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="counter">Counter / Increment Stepper (+1, +5, +10)</SelectItem>
                    <SelectItem value="boolean">Boolean Toggle / Checkbox</SelectItem>
                    <SelectItem value="select">Dropdown / Option Select (with custom point values)</SelectItem>
                    <SelectItem value="number">Simple Number Input</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="item-label">Display Label</Label>
                  <Input
                    id="item-label"
                    value={editingItem.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setEditingItem((prev) => {
                        if (!prev) return null;
                        const shouldUpdateKey = !prev.originalKey && (!prev.key || prev.key === slugifyKey(prev.label));
                        return {
                          ...prev,
                          label: newLabel,
                          key: shouldUpdateKey ? slugifyKey(newLabel) : prev.key,
                        };
                      });
                    }}
                    placeholder="e.g. Fuel Scored (Auto)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="item-key">Field Key (Identifier)</Label>
                  <Input
                    id="item-key"
                    value={editingItem.key}
                    onChange={(e) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, key: slugifyKey(e.target.value) } : null,
                      )
                    }
                    placeholder="e.g. fuel_scored"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-desc">Description (Help Text)</Label>
                <Textarea
                  id="item-desc"
                  value={editingItem.description}
                  onChange={(e) =>
                    setEditingItem((prev) => (prev ? { ...prev, description: e.target.value } : null))
                  }
                  rows={2}
                  placeholder="Describe how scouters should count or score this action..."
                />
              </div>

              {editingItem.componentType === "counter" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="item-points">Points per Action</Label>
                    <Input
                      id="item-points"
                      type="number"
                      value={editingItem.points}
                      onChange={(e) =>
                        setEditingItem((prev) =>
                          prev ? { ...prev, points: parseFloat(e.target.value) || 0 } : null,
                        )
                      }
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="item-increments">Stepper Buttons</Label>
                    <Input
                      id="item-increments"
                      value={editingItem.incrementsStr}
                      onChange={(e) =>
                        setEditingItem((prev) =>
                          prev ? { ...prev, incrementsStr: e.target.value } : null,
                        )
                      }
                      placeholder="1, 5, 10"
                    />
                    <p className="text-[11px] text-muted-foreground">Comma-separated step buttons</p>
                  </div>
                </div>
              )}

              {editingItem.componentType === "boolean" && (
                <div className="space-y-2">
                  <Label htmlFor="item-points-bool">Points if True</Label>
                  <Input
                    id="item-points-bool"
                    type="number"
                    value={editingItem.points}
                    onChange={(e) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, points: parseFloat(e.target.value) || 0 } : null,
                      )
                    }
                    placeholder="15"
                  />
                </div>
              )}

              {editingItem.componentType === "select" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Select Options & Point Values</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditingItem((prev) =>
                          prev
                            ? {
                                ...prev,
                                pointValues: [...prev.pointValues, { optionKey: "", points: 0 }],
                              }
                            : null,
                        )
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Option
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {editingItem.pointValues.map((pv, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          placeholder="Option name (e.g. L1)"
                          value={pv.optionKey}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingItem((prev) => {
                              if (!prev) return null;
                              const updated = [...prev.pointValues];
                              updated[idx] = { ...updated[idx], optionKey: val };
                              return { ...prev, pointValues: updated };
                            });
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="Points"
                          value={pv.points}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditingItem((prev) => {
                              if (!prev) return null;
                              const updated = [...prev.pointValues];
                              updated[idx] = { ...updated[idx], points: val };
                              return { ...prev, pointValues: updated };
                            });
                          }}
                          className="w-24"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            setEditingItem((prev) => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                pointValues: prev.pointValues.filter((_, i) => i !== idx),
                              };
                            });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1 border-t border-border">
                <Label htmlFor="item-depends-on">Conditional Dependency (Optional)</Label>
                <Input
                  id="item-depends-on"
                  value={editingItem.dependsOn}
                  onChange={(e) =>
                    setEditingItem((prev) => (prev ? { ...prev, dependsOn: e.target.value } : null))
                  }
                  placeholder="e.g. has_climb"
                />
                <p className="text-[11px] text-muted-foreground">
                  Only show this field when the specified boolean field key is checked.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>Save Component</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
