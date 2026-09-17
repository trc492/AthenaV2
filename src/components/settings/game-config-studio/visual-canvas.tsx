"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { FieldDrawingCanvas } from "@/components/forms/field-drawing-canvas";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users,
  Plus,
  Minus,
  CheckCircle,
  GripVertical,
  Trash2,
  Copy,
  Pencil,
  Sparkles,
  MousePointer,
  Play,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Lock,
} from "lucide-react";
import type { YearConfig, ScoringDefinition } from "@/lib/types";
import {
  getFieldType,
  encodeStartPosition,
} from "@/components/forms/match-form-utils";
import type { SelectedComponentInfo } from "./property-inspector";
import type { PaletteComponentType } from "./component-palette";

interface VisualCanvasProps {
  config: YearConfig;
  year: number;
  scoutingMode: "match" | "pit";
  activeSection: string;
  isTestMode: boolean;
  viewportDevice: "responsive" | "tablet" | "phone";
  selectedComponent: SelectedComponentInfo | null;
  onSectionChange: (section: string) => void;
  onSelectComponent: (comp: SelectedComponentInfo | null) => void;
  onDuplicateComponent: (comp: SelectedComponentInfo) => void;
  onDeleteComponent: (comp: SelectedComponentInfo) => void;
  onDropComponent: (type: PaletteComponentType, section: string) => void;
  onReorderComponents: (section: string, newKeysOrder: string[]) => void;
}

export function VisualCanvas({
  config,
  year,
  scoutingMode,
  activeSection,
  isTestMode,
  viewportDevice,
  selectedComponent,
  onSectionChange,
  onSelectComponent,
  onDuplicateComponent,
  onDeleteComponent,
  onDropComponent,
  onReorderComponents,
}: VisualCanvasProps) {
  const [isPaletteDragOver, setIsPaletteDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [testData, setTestData] = useState<Record<string, any>>({});
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  // Global cleanup on dragend
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      dragCounterRef.current = 0;
      setIsPaletteDragOver(false);
      setDraggedKey(null);
      setDropTargetKey(null);
    };
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, []);

  // Palette Drag Over handlers
  const handleDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/athena-component")) {
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsPaletteDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/athena-component")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/athena-component")) {
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsPaletteDragOver(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    dragCounterRef.current = 0;
    setIsPaletteDragOver(false);

    // If dropping a new component from palette
    if (e.dataTransfer.types.includes("application/athena-component")) {
      e.preventDefault();
      const componentType = e.dataTransfer.getData("application/athena-component") as PaletteComponentType;
      if (componentType) {
        onDropComponent(componentType, activeSection);
      }
    }
  };

  const updateTestValue = (key: string, val: any) => {
    setTestData((prev) => ({ ...prev, [key]: val }));
  };

  const handleResetTest = () => {
    setTestData({});
  };

  // Viewport width styling
  const viewportStyles = {
    responsive: "w-full max-w-5xl",
    tablet: "w-full max-w-[768px]",
    phone: "w-full max-w-[420px]",
  }[viewportDevice];

  // Match Scouting sections
  const matchSections = [
    { id: "autonomous", label: "Auto", icon: <Zap className="h-4 w-4 text-amber-500" /> },
    { id: "teleop", label: "Teleop", icon: <Award className="h-4 w-4 text-blue-500" /> },
    { id: "endgame", label: "Endgame", icon: <AlertTriangle className="h-4 w-4 text-purple-500" /> },
    { id: "fouls", label: "Fouls", icon: <ShieldAlert className="h-4 w-4 text-rose-500" /> },
  ];

  // Pit Scouting sections
  const pitSections = [
    { id: "autonomous", label: "Auto", icon: <Zap className="h-4 w-4 text-amber-500" /> },
    { id: "teleoperated", label: "Teleop", icon: <Award className="h-4 w-4 text-blue-500" /> },
    { id: "driveTeam", label: "Drive Team", icon: <Users className="h-4 w-4 text-emerald-500" /> },
    { id: "endgame", label: "Endgame", icon: <AlertTriangle className="h-4 w-4 text-purple-500" /> },
  ];

  const currentSections = scoutingMode === "match" ? matchSections : pitSections;

  // Active section items
  const matchSectionItems = (config.scoring?.[activeSection as keyof typeof config.scoring] || {}) as Record<string, ScoringDefinition>;
  const pitSectionItems = (config.pitScouting?.[activeSection as keyof typeof config.pitScouting] || {}) as Record<string, any>;
  const currentItems = scoutingMode === "match" ? matchSectionItems : pitSectionItems;
  const currentItemKeys = Object.keys(currentItems);

  // Internal drag to reorder
  const handleItemDragStart = (e: React.DragEvent, key: string) => {
    e.stopPropagation();
    setDraggedKey(key);
    e.dataTransfer.setData("application/athena-reorder", key);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (e: React.DragEvent, targetKey: string) => {
    if (e.dataTransfer.types.includes("application/athena-reorder")) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (dropTargetKey !== targetKey) {
        setDropTargetKey(targetKey);
      }
    }
  };

  const handleItemDropOn = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetKey(null);

    const sourceKey = e.dataTransfer.getData("application/athena-reorder") || draggedKey;
    if (!sourceKey || sourceKey === targetKey) {
      setDraggedKey(null);
      return;
    }

    const keys = [...currentItemKeys];
    const dragIdx = keys.indexOf(sourceKey);
    const targetIdx = keys.indexOf(targetKey);

    if (dragIdx !== -1 && targetIdx !== -1) {
      keys.splice(dragIdx, 1);
      keys.splice(targetIdx, 0, sourceKey);
      onReorderComponents(activeSection, keys);
    }
    setDraggedKey(null);
  };

  // 1-Click Swap position handlers
  const handleMoveItem = (key: string, direction: "prev" | "next") => {
    const keys = [...currentItemKeys];
    const idx = keys.indexOf(key);
    if (idx === -1) return;

    if (direction === "prev" && idx > 0) {
      const temp = keys[idx - 1];
      keys[idx - 1] = keys[idx];
      keys[idx] = temp;
      onReorderComponents(activeSection, keys);
    } else if (direction === "next" && idx < keys.length - 1) {
      const temp = keys[idx + 1];
      keys[idx + 1] = keys[idx];
      keys[idx] = temp;
      onReorderComponents(activeSection, keys);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative mx-auto transition-all duration-300 ${viewportStyles}`}
    >
      {/* Visual Canvas Card */}
      <div className="rounded-2xl border-2 border-border bg-card shadow-xl overflow-hidden">
        {/* Canvas Header / Device App Bar */}
        <div className="bg-muted/60 border-b border-border p-3.5 sm:px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-foreground flex items-center gap-2">
                  {config.competitionType || "FRC"} {year} • {config.gameName || "Scouting Form"}
                </span>
                <Badge
                  variant={isTestMode ? "default" : "secondary"}
                  className="text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wider"
                >
                  {isTestMode ? (
                    <span className="flex items-center gap-1 text-emerald-300">
                      <Play className="h-3 w-3 fill-current" /> Live Interactive
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <MousePointer className="h-3 w-3" /> Visual Edit Mode
                    </span>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isTestMode
                  ? "Click buttons to test scoring increments and form behavior live."
                  : "Click any component to inspect properties, or drag / use arrows to reorder."}
              </p>
            </div>

            {isTestMode && (
              <Button size="sm" variant="outline" onClick={handleResetTest} className="h-7 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> Reset Values
              </Button>
            )}
          </div>

          {/* Section Tabs */}
          <Tabs value={activeSection} onValueChange={onSectionChange} className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-10 p-1 bg-background/80 border">
              {currentSections.map((sec) => (
                <TabsTrigger
                  key={sec.id}
                  value={sec.id}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5"
                >
                  {sec.icon}
                  <span className="truncate">{sec.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground ml-0.5">
                    ({Object.keys(
                      scoutingMode === "match"
                        ? (config.scoring?.[sec.id as keyof typeof config.scoring] || {})
                        : (config.pitScouting?.[sec.id as keyof typeof config.pitScouting] || {}),
                    ).length})
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Start Position Bar (if Match Auto) */}
        {scoutingMode === "match" && activeSection === "autonomous" && (
          <div className="bg-primary/5 border-b border-primary/10 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Starting Position Field
            </span>
            <div className="flex items-center gap-2">
              <Select
                defaultValue={encodeStartPosition(
                  config.startPositions?.[0] || "Center",
                )}
              >
                <SelectTrigger className="h-7 text-xs w-36 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(config.startPositions || ["Left", "Center", "Right"]).map((pos, idx) => (
                    <SelectItem
                      key={idx}
                      value={encodeStartPosition(pos)}
                      className="text-xs"
                    >
                      {pos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Canvas Body / Drop Zone */}
        <div className="p-4 sm:p-6 min-h-[460px] relative bg-dot-pattern">
          {/* Palette Drop Overlay (Only appears when dragging a component from the left palette) */}
          {isPaletteDragOver && (
            <div className="absolute inset-2 z-30 rounded-xl border-2 border-dashed border-primary bg-primary/15 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none transition-all duration-200">
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg mb-2 animate-bounce">
                <Plus className="h-6 w-6" />
              </div>
              <span className="font-bold text-base text-primary">Drop to Add Component</span>
              <span className="text-xs text-muted-foreground">Adding to {activeSection} section</span>
            </div>
          )}

          {scoutingMode === "pit" && (
            <div className="mb-6 rounded-xl border border-dashed bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Robot Specifications
                </span>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Always present
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Length (in)", "Width (in)", "Weight (lbs)"].map((label) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      readOnly
                      placeholder="0"
                      className="h-9 bg-background text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentItemKeys.length === 0 ? (
            /* Empty Section State */
            <div className="border-2 border-dashed border-border/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[380px] bg-muted/10">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-3 shadow-inner">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground">No components in {activeSection}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
                Drag a component from the left library or click a quick-add preset below to start designing this section.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {scoutingMode === "match" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDropComponent("multi-stepper", activeSection)}
                      className="text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Multi-Stepper
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDropComponent("boolean-toggle", activeSection)}
                      className="text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Action Toggle
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDropComponent("select-dropdown", activeSection)}
                      className="text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Dropdown
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDropComponent("pit-text", activeSection)}
                      className="text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Text Field
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDropComponent("pit-select", activeSection)}
                      className="text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Dropdown
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDropComponent("pit-multiselect", activeSection)}
                      className="text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Checkbox Group
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Render Components on Canvas */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
              {currentItemKeys.map((key, index) => {
                const isSelected =
                  selectedComponent?.mode === scoutingMode &&
                  selectedComponent?.section === activeSection &&
                  selectedComponent?.fieldKey === key;

                const isTarget = dropTargetKey === key;

                if (scoutingMode === "match") {
                  const def = matchSectionItems[key];
                  return (
                    <MatchCanvasItem
                      key={key}
                      fieldKey={key}
                      def={def}
                      index={index}
                      totalItems={currentItemKeys.length}
                      isSelected={isSelected}
                      isDropTarget={isTarget}
                      isTestMode={isTestMode}
                      testValue={testData[key]}
                      onTestChange={(val) => updateTestValue(key, val)}
                      onSelect={() => onSelectComponent({ mode: "match", section: activeSection, fieldKey: key })}
                      onDuplicate={() => onDuplicateComponent({ mode: "match", section: activeSection, fieldKey: key })}
                      onDelete={() => onDeleteComponent({ mode: "match", section: activeSection, fieldKey: key })}
                      onMove={(dir) => handleMoveItem(key, dir)}
                      onDragStart={(e) => handleItemDragStart(e, key)}
                      onDragOver={(e) => handleItemDragOver(e, key)}
                      onDropOn={(e) => handleItemDropOn(e, key)}
                    />
                  );
                } else {
                  const field = pitSectionItems[key];
                  return (
                    <PitCanvasItem
                      key={key}
                      fieldKey={key}
                      field={field}
                      index={index}
                      totalItems={currentItemKeys.length}
                      isSelected={isSelected}
                      isDropTarget={isTarget}
                      isTestMode={isTestMode}
                      testValue={testData[key]}
                      onTestChange={(val) => updateTestValue(key, val)}
                      onSelect={() => onSelectComponent({ mode: "pit", section: activeSection, fieldKey: key })}
                      onDuplicate={() => onDuplicateComponent({ mode: "pit", section: activeSection, fieldKey: key })}
                      onDelete={() => onDeleteComponent({ mode: "pit", section: activeSection, fieldKey: key })}
                      onMove={(dir) => handleMoveItem(key, dir)}
                      onDragStart={(e) => handleItemDragStart(e, key)}
                      onDragOver={(e) => handleItemDragOver(e, key)}
                      onDropOn={(e) => handleItemDropOn(e, key)}
                    />
                  );
                }
              })}
            </div>
          )}

          {/* Parts of the real form that aren't configurable, shown so the
              canvas matches what scouts actually see. */}
          {scoutingMode === "pit" && activeSection === "autonomous" && (
            <FixedFormSection title="Autonomous Path Drawing">
              <FieldDrawingCanvas initialData="" readOnly />
            </FixedFormSection>
          )}

          <FixedFormSection title="Notes">
            <Textarea
              readOnly
              placeholder="Additional observations..."
              className="min-h-20 resize-none bg-background"
            />
          </FixedFormSection>
        </div>
      </div>
    </div>
  );
}

/** A built-in part of the scouting form: rendered for fidelity, not editable. */
function FixedFormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Lock className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          {title}
        </span>
        <Badge variant="outline" className="ml-auto text-[10px]">
          Always present
        </Badge>
      </div>
      {children}
    </div>
  );
}

/**
 * Match Scouting Canvas Component
 */
function MatchCanvasItem({
  fieldKey,
  def,
  index,
  totalItems,
  isSelected,
  isDropTarget,
  isTestMode,
  testValue,
  onTestChange,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
  onDragStart,
  onDragOver,
  onDropOn,
}: {
  fieldKey: string;
  def: ScoringDefinition;
  index: number;
  totalItems: number;
  isSelected: boolean;
  isDropTarget: boolean;
  isTestMode: boolean;
  testValue: any;
  onTestChange: (val: any) => void;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: "prev" | "next") => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDropOn: (e: React.DragEvent) => void;
}) {
  // Same inference the real scouting form uses, so the preview can't disagree
  const fieldType = getFieldType(def);
  const isBool = fieldType === "boolean";
  const isSelect = fieldType === "select";
  const isCounter = !!def.increments && def.increments.length > 0;
  const isMultiStep = isCounter && (def.increments?.length || 0) > 1;

  const currentVal = testValue ?? (isBool ? false : isSelect ? Object.keys(def.pointValues || {})[0] || "" : 0);

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDropOn}
      onClick={() => {
        if (!isTestMode) onSelect();
      }}
      className={`group relative rounded-xl transition-all duration-200 select-none ${
        isMultiStep ? "sm:col-span-2 lg:col-span-3" : ""
      } ${
        isDropTarget
          ? "ring-4 ring-primary border-primary bg-primary/5 scale-[1.01]"
          : isSelected
            ? "ring-2 ring-primary ring-offset-2 bg-card shadow-lg z-10"
            : "border-2 border-border/80 hover:border-primary/50 bg-card hover:shadow-md"
      }`}
    >
      {/* Top Selection Ribbon / Action Bar with Move Arrows & Drag Handle */}
      {!isTestMode && (
        <div
          className={`flex items-center justify-between px-3 py-1.5 border-b text-xs transition-colors rounded-t-xl ${
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div
              draggable
              onDragStart={onDragStart}
              className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
              title="Drag to reorder"
            >
              <GripVertical className="h-3.5 w-3.5 opacity-70 hover:opacity-100" />
            </div>

            <span className="font-mono text-[11px] font-bold truncate max-w-[140px]">{fieldKey}</span>
            {def.points !== undefined && (
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${isSelected ? "border-white/40 text-white" : ""}`}>
                {def.points} pts
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
            {/* Quick Move Arrows */}
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                onMove("prev");
              }}
              title="Move earlier"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={index === totalItems - 1}
              onClick={(e) => {
                e.stopPropagation();
                onMove("next");
              }}
              title="Move later"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowRight className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate"
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
              className="p-1 rounded hover:bg-destructive/20 text-destructive-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Component Visual Layout */}
      <div className="p-4 space-y-2.5">
        <div>
          <Label className="text-sm font-semibold tracking-tight block text-foreground">
            {def.label}
          </Label>
          {def.description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{def.description}</p>
          )}
        </div>

        {/* 1. Multi-Step Stepper (with decrements and increments) */}
        {isMultiStep && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 w-full">
              {/* Decrement buttons */}
              {[...(def.increments || [])].reverse().map((inc) => (
                <Button
                  key={`dec-${inc}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTestChange(Math.max(0, Number(currentVal) - inc));
                  }}
                  className="h-14 min-w-0 flex-1 px-1 text-sm font-bold border-2"
                >
                  -{inc}
                </Button>
              ))}

              {/* Number Value Display */}
              <div className="w-16 sm:w-28 flex-shrink-0 text-center text-xl font-mono font-bold bg-muted rounded-md border flex items-center justify-center h-14 text-primary">
                {currentVal}
              </div>

              {/* Increment buttons */}
              {(def.increments || []).map((inc) => (
                <Button
                  key={`inc-${inc}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTestChange(Number(currentVal) + inc);
                  }}
                  className="h-14 min-w-0 flex-1 px-1 text-sm font-bold border-2"
                >
                  +{inc}
                </Button>
              ))}
            </div>
            {def.points ? (
              <div className="text-[11px] text-center text-muted-foreground">{def.points} points each</div>
            ) : null}
          </div>
        )}

        {/* 2. Simple Stepper */}
        {isCounter && !isMultiStep && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onTestChange(Math.max(0, Number(currentVal) - 1));
                }}
                className="h-16 w-16 p-0 flex-shrink-0 border-2 font-bold text-lg"
              >
                <Minus className="h-6 w-6" />
              </Button>
              <div className="w-20 text-center text-2xl font-mono font-bold text-primary flex items-center justify-center">
                {currentVal}
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onTestChange(Number(currentVal) + 1);
                }}
                className="h-16 w-16 p-0 flex-shrink-0 border-2 font-bold text-lg"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
            {def.points ? (
              <div className="text-[11px] text-center text-muted-foreground">{def.points} points each</div>
            ) : null}
          </div>
        )}

        {/* 3. Action Toggle */}
        {isBool && (
          <div className="space-y-1.5">
            <Button
              type="button"
              variant={Boolean(currentVal) ? "default" : "outline"}
              size="lg"
              onClick={(e) => {
                e.stopPropagation();
                onTestChange(!Boolean(currentVal));
              }}
              className="h-16 w-full font-bold text-base transition-all duration-200 border-2"
            >
              {Boolean(currentVal) ? (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Yes (Achieved)
                </>
              ) : (
                <>
                  <Minus className="mr-2 h-5 w-5" />
                  No
                </>
              )}
            </Button>
            {def.points ? (
              <div className="text-[11px] text-center text-muted-foreground">{def.points} points</div>
            ) : null}
          </div>
        )}

        {/* 4. Select Dropdown */}
        {isSelect && (
          <div className="space-y-1.5">
            <Select value={String(currentVal)} onValueChange={(val) => onTestChange(val)}>
              <SelectTrigger className="h-14 w-full text-sm font-semibold border-2 bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(def.pointValues || {}).map(([opt, pts]) => (
                  <SelectItem key={opt} value={opt} className="text-sm py-2">
                    <div className="flex justify-between items-center w-full gap-4">
                      <span>{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
                      {Number(pts) !== 0 && (
                        <span className="text-muted-foreground font-mono text-xs">({pts} pts)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-[11px] text-center text-muted-foreground">Points vary by selection</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pit Scouting Canvas Component
 */
function PitCanvasItem({
  fieldKey,
  field,
  index,
  totalItems,
  isSelected,
  isDropTarget,
  isTestMode,
  testValue,
  onTestChange,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
  onDragStart,
  onDragOver,
  onDropOn,
}: {
  fieldKey: string;
  field: any;
  index: number;
  totalItems: number;
  isSelected: boolean;
  isDropTarget: boolean;
  isTestMode: boolean;
  testValue: any;
  onTestChange: (val: any) => void;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: "prev" | "next") => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDropOn: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDropOn}
      onClick={() => {
        if (!isTestMode) onSelect();
      }}
      className={`group relative rounded-xl border-2 transition-all duration-200 select-none bg-card p-4 space-y-2.5 ${
        isDropTarget
          ? "ring-4 ring-primary border-primary bg-primary/5 scale-[1.01]"
          : isSelected
            ? "ring-2 ring-primary ring-offset-2 border-primary shadow-lg"
            : "border-border/80 hover:border-primary/50 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-semibold block">{field.label}</Label>
          <span className="text-[10px] font-mono text-muted-foreground">{fieldKey}</span>
        </div>

        {!isTestMode && (
          <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
            <div
              draggable
              onDragStart={onDragStart}
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted"
              title="Drag to reorder"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                onMove("prev");
              }}
              title="Move up"
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={index === totalItems - 1}
              onClick={(e) => {
                e.stopPropagation();
                onMove("next");
              }}
              title="Move down"
              className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {field.type === "text" && (
        <Input
          value={testValue || ""}
          onChange={(e) => onTestChange(e.target.value)}
          placeholder="Enter notes..."
          className="h-10 text-xs"
        />
      )}

      {field.type === "number" && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onTestChange(Math.max(0, (testValue || 0) - 1));
            }}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            value={testValue ?? 0}
            onChange={(e) => onTestChange(parseFloat(e.target.value) || 0)}
            className="text-center font-mono font-bold text-sm h-10"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onTestChange((testValue || 0) + 1);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {field.type === "boolean" && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border">
          <span className="text-xs font-medium">{testValue ? "Yes" : "No"}</span>
          <Switch checked={!!testValue} onCheckedChange={(checked) => onTestChange(checked)} />
        </div>
      )}

      {field.type === "select" && (
        <Select value={testValue || ""} onValueChange={(val) => onTestChange(val)}>
          <SelectTrigger className="h-10 text-xs">
            <SelectValue placeholder="Select option" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt: string, i: number) => (
              <SelectItem key={i} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === "multiselect" && (
        <div className="space-y-1.5 p-2 rounded-lg bg-muted/30 border">
          {(field.options || []).map((opt: string, i: number) => {
            const selected: string[] = testValue || [];
            const isChecked = selected.includes(opt);
            return (
              <div key={i} className="flex items-center gap-2">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) onTestChange([...selected, opt]);
                    else onTestChange(selected.filter((o) => o !== opt));
                  }}
                />
                <span className="text-xs">{opt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
