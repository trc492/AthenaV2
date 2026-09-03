"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Users,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Type,
  Hash,
  ToggleLeft,
  ListFilter,
  CheckSquare,
  X,
} from "lucide-react";
import type { YearConfig } from "@/lib/types";
import { slugifyKey } from "./types";

interface BuilderPitScoutingProps {
  config: YearConfig;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
}

type PitCategory = "autonomous" | "teleoperated" | "driveTeam" | "endgame";

interface PitFieldDef {
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect";
  options?: string[];
  dependsOn?: string;
}

interface EditingPitItem {
  section: PitCategory;
  originalKey?: string;
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multiselect";
  options: string[];
  dependsOn: string;
}

export function BuilderPitScouting({
  config,
  onUpdateConfig,
}: BuilderPitScoutingProps) {
  const [activeCategory, setActiveCategory] = useState<PitCategory>("autonomous");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingPitItem | null>(null);
  const [newOptionText, setNewOptionText] = useState("");

  const pitConfig = config.pitScouting || {
    autonomous: {},
    teleoperated: {},
    driveTeam: {},
    endgame: {},
  };

  const currentCategoryItems = (pitConfig[activeCategory] || {}) as Record<string, PitFieldDef>;

  const handleOpenAdd = () => {
    setEditingItem({
      section: activeCategory,
      key: "",
      label: "",
      type: "text",
      options: ["Option 1", "Option 2"],
      dependsOn: "",
    });
    setNewOptionText("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (fieldKey: string, field: PitFieldDef) => {
    setEditingItem({
      section: activeCategory,
      originalKey: fieldKey,
      key: fieldKey,
      label: field.label || "",
      type: field.type || "text",
      options: field.options ? [...field.options] : [],
      dependsOn: field.dependsOn || "",
    });
    setNewOptionText("");
    setIsDialogOpen(true);
  };

  const handleDuplicate = (fieldKey: string, field: PitFieldDef) => {
    const newKey = `${fieldKey}_copy`;
    onUpdateConfig((prev) => {
      const pit = { ...prev.pitScouting };
      const sec = { ...((pit[activeCategory] || {}) as Record<string, PitFieldDef>) };
      sec[newKey] = {
        ...field,
        label: `${field.label} (Copy)`,
      };
      return {
        ...prev,
        pitScouting: {
          ...pit,
          [activeCategory]: sec,
        },
      };
    });
  };

  const handleDelete = (fieldKey: string) => {
    onUpdateConfig((prev) => {
      const pit = { ...prev.pitScouting };
      const sec = { ...((pit[activeCategory] || {}) as Record<string, PitFieldDef>) };
      delete sec[fieldKey];
      return {
        ...prev,
        pitScouting: {
          ...pit,
          [activeCategory]: sec,
        },
      };
    });
  };

  const handleAddOption = () => {
    const trimmed = newOptionText.trim();
    if (!trimmed || !editingItem) return;
    if (!editingItem.options.includes(trimmed)) {
      setEditingItem({
        ...editingItem,
        options: [...editingItem.options, trimmed],
      });
    }
    setNewOptionText("");
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (!editingItem) return;
    setEditingItem({
      ...editingItem,
      options: editingItem.options.filter((_, i) => i !== indexToRemove),
    });
  };

  const handleSaveItem = () => {
    if (!editingItem) return;
    const finalKey = editingItem.key.trim() || slugifyKey(editingItem.label) || "field";

    const def: PitFieldDef = {
      label: editingItem.label || finalKey,
      type: editingItem.type,
    };

    if (editingItem.type === "select" || editingItem.type === "multiselect") {
      def.options = editingItem.options.length > 0 ? editingItem.options : ["Option 1"];
    }

    if (editingItem.dependsOn.trim()) {
      def.dependsOn = editingItem.dependsOn.trim();
    }

    onUpdateConfig((prev) => {
      const pit = { ...prev.pitScouting };
      const sec = { ...((pit[activeCategory] || {}) as Record<string, PitFieldDef>) };

      if (editingItem.originalKey && editingItem.originalKey !== finalKey) {
        delete sec[editingItem.originalKey];
      }

      sec[finalKey] = def;

      return {
        ...prev,
        pitScouting: {
          ...pit,
          [activeCategory]: sec,
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
          value={activeCategory}
          onValueChange={(val) => setActiveCategory(val as PitCategory)}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto h-auto p-1">
            <TabsTrigger value="autonomous" className="flex items-center gap-1.5 py-1.5 px-3">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Auto</span>
            </TabsTrigger>
            <TabsTrigger value="teleoperated" className="flex items-center gap-1.5 py-1.5 px-3">
              <Award className="h-4 w-4 text-blue-500" />
              <span>Teleop</span>
            </TabsTrigger>
            <TabsTrigger value="driveTeam" className="flex items-center gap-1.5 py-1.5 px-3">
              <Users className="h-4 w-4 text-emerald-500" />
              <span>Drive Team</span>
            </TabsTrigger>
            <TabsTrigger value="endgame" className="flex items-center gap-1.5 py-1.5 px-3">
              <AlertTriangle className="h-4 w-4 text-purple-500" />
              <span>Endgame</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button onClick={handleOpenAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Pit Question
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(currentCategoryItems).length === 0 ? (
          <div className="col-span-full border-2 border-dashed border-border rounded-xl p-8 text-center bg-card/40">
            <p className="text-muted-foreground mb-3">
              No pit scouting fields defined in {activeCategory}.
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenAdd}>
              <Plus className="h-4 w-4 mr-1.5" /> Add First Field
            </Button>
          </div>
        ) : (
          Object.entries(currentCategoryItems).map(([key, field]) => {
            return (
              <Card key={key} className="relative group hover:border-primary/50 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-semibold">{field.label}</CardTitle>
                      <Badge variant="secondary" className="font-mono text-xs text-muted-foreground">
                        {key}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleDuplicate(key, field)}
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => handleOpenEdit(key, field)}
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
                </CardHeader>
                <CardContent className="pt-0 text-xs space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {field.type === "text" && (
                      <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30 flex items-center gap-1">
                        <Type className="h-3 w-3" /> Text Input
                      </Badge>
                    )}
                    {field.type === "number" && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Number
                      </Badge>
                    )}
                    {field.type === "boolean" && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1">
                        <ToggleLeft className="h-3 w-3" /> Boolean Toggle
                      </Badge>
                    )}
                    {field.type === "select" && (
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1">
                        <ListFilter className="h-3 w-3" /> Single Select ({field.options?.length || 0} options)
                      </Badge>
                    )}
                    {field.type === "multiselect" && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                        <CheckSquare className="h-3 w-3" /> Multi Select ({field.options?.length || 0} options)
                      </Badge>
                    )}

                    {field.dependsOn && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                        Depends on: {field.dependsOn}
                      </Badge>
                    )}
                  </div>

                  {field.options && field.options.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 text-[11px]">
                      {field.options.map((opt, i) => (
                        <span key={i} className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {opt}
                        </span>
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
              {editingItem?.originalKey ? "Edit Pit Question" : "Add Pit Question"}
            </DialogTitle>
            <DialogDescription>
              Configure question details for pit scouting in {activeCategory}.
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="pit-type-select">Field Type</Label>
                <Select
                  value={editingItem.type}
                  onValueChange={(val: "text" | "number" | "boolean" | "select" | "multiselect") =>
                    setEditingItem((prev) => (prev ? { ...prev, type: val } : null))
                  }
                >
                  <SelectTrigger id="pit-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text Input (e.g. general notes / model)</SelectItem>
                    <SelectItem value="number">Number (e.g. capacity, weight, cycle time)</SelectItem>
                    <SelectItem value="boolean">Boolean Toggle (Yes / No)</SelectItem>
                    <SelectItem value="select">Single Dropdown Select</SelectItem>
                    <SelectItem value="multiselect">Multi-select Checkbox Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="pit-label">Question Label</Label>
                  <Input
                    id="pit-label"
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
                    placeholder="e.g. Hopper Capacity"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pit-key">Field Key</Label>
                  <Input
                    id="pit-key"
                    value={editingItem.key}
                    onChange={(e) =>
                      setEditingItem((prev) =>
                        prev ? { ...prev, key: slugifyKey(e.target.value) } : null,
                      )
                    }
                    placeholder="e.g. hopperCapacity"
                  />
                </div>
              </div>

              {(editingItem.type === "select" || editingItem.type === "multiselect") && (
                <div className="space-y-3">
                  <Label>Choice Options</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an option..."
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                    />
                    <Button type="button" variant="secondary" onClick={handleAddOption}>
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-muted/20 rounded border border-border/50">
                    {editingItem.options.map((opt, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="px-2 py-1 flex items-center gap-1 text-xs"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1 border-t border-border">
                <Label htmlFor="pit-depends-on">Conditional Dependency (Optional)</Label>
                <Input
                  id="pit-depends-on"
                  value={editingItem.dependsOn}
                  onChange={(e) =>
                    setEditingItem((prev) => (prev ? { ...prev, dependsOn: e.target.value } : null))
                  }
                  placeholder="e.g. canClimb"
                />
                <p className="text-[11px] text-muted-foreground">
                  Only show this field if the parent boolean field is true.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>Save Question</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
