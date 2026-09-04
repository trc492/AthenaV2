"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  GripVertical,
  CheckCircle,
  Minus,
  ChevronDown,
  Type,
  Hash,
  ToggleLeft,
  ListFilter,
  CheckSquare,
  Sparkles,
} from "lucide-react";

export type PaletteComponentType =
  | "multi-stepper"
  | "simple-stepper"
  | "boolean-toggle"
  | "select-dropdown"
  | "number-input"
  | "pit-text"
  | "pit-number"
  | "pit-boolean"
  | "pit-select"
  | "pit-multiselect";

interface ComponentPaletteProps {
  scoutingMode: "match" | "pit";
  onAddComponent: (type: PaletteComponentType) => void;
}

export function ComponentPalette({
  scoutingMode,
  onAddComponent,
}: ComponentPaletteProps) {
  const handleDragStart = (e: React.DragEvent, type: PaletteComponentType) => {
    e.dataTransfer.setData("application/athena-component", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="w-full h-full flex flex-col bg-card/60 rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Component Library
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
            Click or Drag
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {scoutingMode === "match"
            ? "Click or drag scoring widgets onto the form"
            : "Click or drag survey questions onto the form"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {scoutingMode === "match" ? (
          <>
            {/* Multi-Step Stepper */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "multi-stepper")}
              onClick={() => onAddComponent("multi-stepper")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  Multi-Step Stepper
                </span>
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 rounded-full hover:bg-primary hover:text-primary-foreground"
                    title="Click to Add"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Realistic Mini Preview */}
              <div className="flex items-center gap-1 w-full bg-muted/40 p-1.5 rounded-md border border-border/40 pointer-events-none">
                <div className="flex gap-0.5 flex-1">
                  <span className="flex-1 text-[10px] font-bold bg-background border rounded py-1 text-center shadow-2xs">
                    -5
                  </span>
                  <span className="flex-1 text-[10px] font-bold bg-background border rounded py-1 text-center shadow-2xs">
                    -1
                  </span>
                </div>
                <span className="w-8 text-center text-xs font-mono font-bold text-primary">
                  0
                </span>
                <div className="flex gap-0.5 flex-1">
                  <span className="flex-1 text-[10px] font-bold bg-background border rounded py-1 text-center shadow-2xs">
                    +1
                  </span>
                  <span className="flex-1 text-[10px] font-bold bg-background border rounded py-1 text-center shadow-2xs">
                    +5
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Quick increment/decrement buttons (e.g. Fuel, Notes, Coral)
              </p>
            </div>

            {/* Simple Stepper */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "simple-stepper")}
              onClick={() => onAddComponent("simple-stepper")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  Simple Stepper
                </span>
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 rounded-full hover:bg-primary hover:text-primary-foreground"
                    title="Click to Add"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Realistic Mini Preview */}
              <div className="flex items-center justify-center gap-2 bg-muted/40 p-1.5 rounded-md border border-border/40 pointer-events-none">
                <span className="h-7 w-7 flex items-center justify-center font-bold bg-background border rounded shadow-2xs text-xs">
                  -
                </span>
                <span className="w-10 text-center text-xs font-mono font-bold text-primary">
                  0
                </span>
                <span className="h-7 w-7 flex items-center justify-center font-bold bg-background border rounded shadow-2xs text-xs">
                  +
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Single +1 / -1 numeric counter with point multiplier
              </p>
            </div>

            {/* Action Toggle (Yes / No) */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "boolean-toggle")}
              onClick={() => onAddComponent("boolean-toggle")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  Action Toggle (Yes / No)
                </span>
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 rounded-full hover:bg-primary hover:text-primary-foreground"
                    title="Click to Add"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Realistic Mini Preview */}
              <div className="h-9 w-full bg-primary/10 border-2 border-primary/40 rounded-md flex items-center justify-center gap-1.5 text-primary text-xs font-semibold pointer-events-none">
                <CheckCircle className="h-4 w-4" />
                <span>Yes (Active)</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Touch-friendly boolean button (e.g. Leave, Climb, Breakdown)
              </p>
            </div>

            {/* Dropdown Select with Points */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "select-dropdown")}
              onClick={() => onAddComponent("select-dropdown")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  Dropdown Selector
                </span>
                <div className="flex items-center gap-1">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-40 group-hover:opacity-100" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 rounded-full hover:bg-primary hover:text-primary-foreground"
                    title="Click to Add"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Realistic Mini Preview */}
              <div className="h-9 w-full bg-muted/60 border rounded-md px-2.5 flex items-center justify-between text-xs pointer-events-none">
                <span className="font-medium text-foreground">Deep Climb (12 pts)</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Dropdown menu with customizable per-option scoring points
              </p>
            </div>
          </>
        ) : (
          /* Pit Scouting Components */
          <>
            {/* Pit Text Input */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "pit-text")}
              onClick={() => onAddComponent("pit-text")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-muted-foreground" /> Text Field
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="h-8 w-full bg-muted/40 border rounded px-2 flex items-center text-[11px] text-muted-foreground pointer-events-none">
                Enter team notes...
              </div>
            </div>

            {/* Pit Number Input */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "pit-number")}
              onClick={() => onAddComponent("pit-number")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" /> Number Stepper
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-2 bg-muted/30 p-1 rounded border pointer-events-none">
                <span className="h-6 w-6 flex items-center justify-center text-xs font-bold border rounded bg-background">
                  -
                </span>
                <span className="text-xs font-mono font-bold w-6 text-center">0</span>
                <span className="h-6 w-6 flex items-center justify-center text-xs font-bold border rounded bg-background">
                  +
                </span>
              </div>
            </div>

            {/* Pit Single Select */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "pit-select")}
              onClick={() => onAddComponent("pit-select")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <ListFilter className="h-3.5 w-3.5 text-muted-foreground" /> Single Select
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="h-8 w-full bg-muted/40 border rounded px-2 flex items-center justify-between text-[11px] pointer-events-none">
                <span>Select option...</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>

            {/* Pit Multi-Select */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "pit-multiselect")}
              onClick={() => onAddComponent("pit-multiselect")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" /> Checkbox Group
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1 p-1 bg-muted/20 border rounded pointer-events-none">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <div className="h-3 w-3 rounded bg-primary flex items-center justify-center text-[8px] text-primary-foreground font-bold">✓</div>
                  <span>Ground Pickup</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <div className="h-3 w-3 rounded border bg-background"></div>
                  <span>Source / Chute</span>
                </div>
              </div>
            </div>

            {/* Pit Boolean Switch */}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, "pit-boolean")}
              onClick={() => onAddComponent("pit-boolean")}
              className="group relative cursor-pointer select-none rounded-lg border border-border bg-card p-2.5 transition-all duration-150 hover:border-primary/50 hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" /> Boolean Switch
                </span>
                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between bg-muted/40 p-2 rounded border pointer-events-none">
                <span className="text-xs">Capability</span>
                <span className="h-5 w-9 rounded-full bg-primary/20 flex items-center px-0.5">
                  <span className="h-4 w-4 rounded-full bg-primary"></span>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
