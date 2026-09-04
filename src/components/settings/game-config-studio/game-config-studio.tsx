"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Save,
  Plus,
  Copy,
  Download,
  Upload,
  Trophy,
  Zap,
  Code,
  FileJson,
  Sparkles,
  MousePointer,
  Play,
  Monitor,
  Tablet,
  Smartphone,
  Sliders,
  Eye,
  Swords,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import type { YearConfig, ScoringDefinition } from "@/lib/types";
import { DEFAULT_NEW_CONFIG, slugifyKey } from "./types";
import { ComponentPalette, PaletteComponentType } from "./component-palette";
import { VisualCanvas } from "./visual-canvas";
import { PropertyInspector, SelectedComponentInfo } from "./property-inspector";
import { VisualMatchupCanvas } from "./visual-matchup-canvas";
import { VisualTeamPageCanvas } from "./visual-teampage-canvas";
import { BuilderJsonEditor } from "./builder-json-editor";

// Static defaults as instant fallback
import FRC2026 from "../../../../config/years/FRC-2026.json";
import FRC2025 from "../../../../config/years/FRC-2025.json";
import FTC2026 from "../../../../config/years/FTC-2026.json";

interface ConfigOption {
  filename: string;
  competitionType: string;
  year: number;
  gameName: string;
  isBuiltin: boolean;
}

export type StudioDesignerMode = "match" | "pit" | "matchup" | "teampage";

export function GameConfigStudio() {
  const [configList, setConfigList] = useState<ConfigOption[]>([
    { filename: "FRC-2026.json", competitionType: "FRC", year: 2026, gameName: (FRC2026 as YearConfig).gameName, isBuiltin: true },
    { filename: "FRC-2025.json", competitionType: "FRC", year: 2025, gameName: (FRC2025 as YearConfig).gameName, isBuiltin: true },
    { filename: "FTC-2026.json", competitionType: "FTC", year: 2026, gameName: (FTC2026 as YearConfig).gameName, isBuiltin: true },
  ]);
  const [selectedFile, setSelectedFile] = useState<string>("FRC-2026.json");
  const [currentConfig, setCurrentConfig] = useState<YearConfig>(() => JSON.parse(JSON.stringify(FRC2026)));
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [isSaving, setIsSaving] = useState(false);

  // Studio Modes & State
  const [studioMode, setStudioMode] = useState<StudioDesignerMode>("match");
  const [activeSection, setActiveSection] = useState<string>("autonomous");
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [viewportDevice, setViewportDevice] = useState<"responsive" | "tablet" | "phone">("responsive");
  const [selectedComponent, setSelectedComponent] = useState<SelectedComponentInfo | null>(null);

  // Advanced Raw JSON Modal
  const [isJsonDialogOpen, setIsJsonDialogOpen] = useState<boolean>(false);

  // Fetch configs list from server
  const fetchConfigs = async () => {
    try {
      const res = await fetch("/api/scouting/admin/configs");
      if (res.ok) {
        const data = await res.json();
        if (data.configs && data.configs.length > 0) {
          setConfigList(data.configs);
        }
      }
    } catch (err) {
      console.error("Failed to load configs from server:", err);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Load selected config
  const handleSelectConfig = async (filename: string) => {
    setSelectedFile(filename);
    setSelectedComponent(null);
    try {
      const res = await fetch(`/api/scouting/admin/configs?file=${encodeURIComponent(filename)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setCurrentConfig(data.config);
          const match = filename.match(/^(FRC|FTC)-(\d{4})\.json$/i);
          if (match) {
            setCurrentYear(parseInt(match[2], 10));
          }
          return;
        }
      }
    } catch {
      // Fallback
    }

    if (filename === "FRC-2026.json") {
      setCurrentConfig(JSON.parse(JSON.stringify(FRC2026)));
      setCurrentYear(2026);
    } else if (filename === "FRC-2025.json") {
      setCurrentConfig(JSON.parse(JSON.stringify(FRC2025)));
      setCurrentYear(2025);
    } else if (filename === "FTC-2026.json") {
      setCurrentConfig(JSON.parse(JSON.stringify(FTC2026)));
      setCurrentYear(2026);
    }
  };

  // Create new blank config
  const handleCreateNew = () => {
    const nextYear = new Date().getFullYear() + 1;
    const freshConfig: YearConfig = {
      ...DEFAULT_NEW_CONFIG,
      gameName: "NEW_GAME",
    };
    setCurrentConfig(freshConfig);
    setCurrentYear(nextYear);
    setSelectedFile(`FRC-${nextYear}.json`);
    setSelectedComponent(null);
    toast.info("Created new blank configuration template");
  };

  // Duplicate current config
  const handleDuplicateCurrent = () => {
    const nextYear = currentYear + 1;
    const cloned = JSON.parse(JSON.stringify(currentConfig)) as YearConfig;
    cloned.gameName = `${cloned.gameName || "GAME"}_COPY`;
    setCurrentConfig(cloned);
    setCurrentYear(nextYear);
    setSelectedFile(`${cloned.competitionType}-${nextYear}.json`);
    setSelectedComponent(null);
    toast.info(`Duplicated configuration as ${cloned.competitionType}-${nextYear}`);
  };

  // Save config to server
  const handleSaveToServer = async () => {
    const compType = currentConfig.competitionType || "FRC";
    const filename = `${compType}-${currentYear}.json`;

    try {
      setIsSaving(true);
      const res = await fetch("/api/scouting/admin/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionType: compType,
          year: currentYear,
          filename,
          config: currentConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.errors?.join(", ") || "Failed to save configuration");
      }

      toast.success(`Saved configuration to ${filename}`);
      fetchConfigs();
      setSelectedFile(filename);
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle adding a component from palette (via click or drag-and-drop)
  const handleAddComponent = (type: PaletteComponentType, sectionTarget?: string) => {
    const targetSec = sectionTarget || activeSection;
    const timestamp = Date.now().toString().slice(-4);

    if (studioMode === "match") {
      let newKey = `scoring_${timestamp}`;
      let newDef: ScoringDefinition;

      switch (type) {
        case "multi-stepper":
          newKey = `stepper_${timestamp}`;
          newDef = {
            label: "Game Element Scored",
            points: 1,
            description: "Count of items scored during match",
            increments: [1, 5, 10],
          };
          break;
        case "simple-stepper":
          newKey = `counter_${timestamp}`;
          newDef = {
            label: "Scored Action",
            points: 2,
            description: "Number of completed actions",
            increments: [1],
          };
          break;
        case "boolean-toggle":
          newKey = `toggle_${timestamp}`;
          newDef = {
            label: "Action Achieved",
            points: 15,
            description: "Status achieved during match",
            type: "boolean",
          };
          break;
        case "select-dropdown":
          newKey = `select_${timestamp}`;
          newDef = {
            label: "Robot Stage / Position",
            description: "Final robot state",
            type: "select",
            pointValues: {
              none: 0,
              level_1: 10,
              level_2: 20,
              level_3: 30,
            },
          };
          break;
        case "number-input":
        default:
          newKey = `numeric_${timestamp}`;
          newDef = {
            label: "Numeric Metric",
            points: 1,
            type: "number",
            description: "Numeric score metric",
          };
          break;
      }

      setCurrentConfig((prev) => {
        const scoring = { ...prev.scoring };
        const sec = { ...((scoring[targetSec as keyof typeof scoring] || {}) as Record<string, ScoringDefinition>) };
        sec[newKey] = newDef;
        return {
          ...prev,
          scoring: {
            ...scoring,
            [targetSec]: sec,
          },
        };
      });

      setSelectedComponent({
        mode: "match",
        section: targetSec,
        fieldKey: newKey,
      });

      toast.success(`Added ${newDef.label} to ${targetSec}`);
    } else {
      // Pit Scouting
      let newKey = `pit_${timestamp}`;
      let newField: any;

      switch (type) {
        case "pit-text":
          newKey = `notes_${timestamp}`;
          newField = { label: "Design Specifications", type: "text" };
          break;
        case "pit-number":
          newKey = `capacity_${timestamp}`;
          newField = { label: "Capacity / Weight", type: "number" };
          break;
        case "pit-boolean":
          newKey = `capability_${timestamp}`;
          newField = { label: "Has Subsystem Capability", type: "boolean" };
          break;
        case "pit-select":
          newKey = `type_${timestamp}`;
          newField = {
            label: "Mechanism Type",
            type: "select",
            options: ["Type A", "Type B", "Custom"],
          };
          break;
        case "pit-multiselect":
        default:
          newKey = `features_${timestamp}`;
          newField = {
            label: "Active Features",
            type: "multiselect",
            options: ["Autonomous Mode", "Auto Align", "Vision Tracking"],
          };
          break;
      }

      setCurrentConfig((prev) => {
        const pit = { ...prev.pitScouting };
        const sec = { ...((pit[targetSec as keyof typeof pit] || {}) as Record<string, any>) };
        sec[newKey] = newField;
        return {
          ...prev,
          pitScouting: {
            ...pit,
            [targetSec]: sec,
          },
        };
      });

      setSelectedComponent({
        mode: "pit",
        section: targetSec,
        fieldKey: newKey,
      });

      toast.success(`Added ${newField.label} to ${targetSec}`);
    }
  };

  // Reorder components on canvas
  const handleReorderComponents = (section: string, newKeysOrder: string[]) => {
    setCurrentConfig((prev) => {
      if (studioMode === "match") {
        const scoring = { ...prev.scoring };
        const existing = (scoring[section as keyof typeof scoring] || {}) as Record<string, ScoringDefinition>;
        const reordered: Record<string, ScoringDefinition> = {};
        newKeysOrder.forEach((k) => {
          if (existing[k]) reordered[k] = existing[k];
        });
        return {
          ...prev,
          scoring: {
            ...scoring,
            [section]: reordered,
          },
        };
      } else {
        const pit = { ...prev.pitScouting };
        const existing = (pit[section as keyof typeof pit] || {}) as Record<string, any>;
        const reordered: Record<string, any> = {};
        newKeysOrder.forEach((k) => {
          if (existing[k]) reordered[k] = existing[k];
        });
        return {
          ...prev,
          pitScouting: {
            ...pit,
            [section]: reordered,
          },
        };
      }
    });
  };

  // Duplicate component
  const handleDuplicateComponent = (comp: SelectedComponentInfo) => {
    const newKey = `${comp.fieldKey}_copy`;
    setCurrentConfig((prev) => {
      if (comp.mode === "match") {
        const scoring = { ...prev.scoring };
        const sec = { ...((scoring[comp.section as keyof typeof scoring] || {}) as Record<string, ScoringDefinition>) };
        if (sec[comp.fieldKey]) {
          sec[newKey] = {
            ...sec[comp.fieldKey],
            label: `${sec[comp.fieldKey].label} (Copy)`,
          };
        }
        return { ...prev, scoring: { ...scoring, [comp.section]: sec } };
      } else {
        const pit = { ...prev.pitScouting };
        const sec = { ...((pit[comp.section as keyof typeof pit] || {}) as Record<string, any>) };
        if (sec[comp.fieldKey]) {
          sec[newKey] = {
            ...sec[comp.fieldKey],
            label: `${sec[comp.fieldKey].label} (Copy)`,
          };
        }
        return { ...prev, pitScouting: { ...pit, [comp.section]: sec } };
      }
    });

    setSelectedComponent({ ...comp, fieldKey: newKey });
    toast.info(`Duplicated as ${newKey}`);
  };

  // Delete component
  const handleDeleteComponent = (comp: SelectedComponentInfo) => {
    setCurrentConfig((prev) => {
      if (comp.mode === "match") {
        const scoring = { ...prev.scoring };
        const sec = { ...((scoring[comp.section as keyof typeof scoring] || {}) as Record<string, ScoringDefinition>) };
        delete sec[comp.fieldKey];
        return { ...prev, scoring: { ...scoring, [comp.section]: sec } };
      } else {
        const pit = { ...prev.pitScouting };
        const sec = { ...((pit[comp.section as keyof typeof pit] || {}) as Record<string, any>) };
        delete sec[comp.fieldKey];
        return { ...prev, pitScouting: { ...pit, [comp.section]: sec } };
      }
    });

    if (selectedComponent?.fieldKey === comp.fieldKey) {
      setSelectedComponent(null);
    }
    toast.info(`Removed component`);
  };

  return (
    <div className="space-y-4">
      {/* Studio Master Header */}
      <div className="rounded-xl border border-border bg-card/80 backdrop-blur-xs p-3 sm:px-5 shadow-xs">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          {/* Title & Config Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Config Studio
                </h2>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Direct visual manipulation scouting form & analytics designer
                </p>
              </div>
            </div>

            <div className="h-6 w-px bg-border hidden sm:block mx-1" />

            {/* Config Selector */}
            <Select value={selectedFile} onValueChange={handleSelectConfig}>
              <SelectTrigger className="w-52 h-9 text-xs font-semibold">
                <SelectValue placeholder="Select Config" />
              </SelectTrigger>
              <SelectContent>
                {configList.map((cfg) => (
                  <SelectItem key={cfg.filename} value={cfg.filename} className="text-xs">
                    {cfg.competitionType} {cfg.year} ({cfg.gameName || cfg.filename})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleCreateNew} className="h-9 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> New
            </Button>
            <Button variant="outline" size="sm" onClick={handleDuplicateCurrent} className="h-9 text-xs">
              <Copy className="h-3.5 w-3.5 mr-1" /> Clone
            </Button>
          </div>

          {/* Controls: Mode, Viewport, Interactive Test, and Save */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-between xl:justify-end">
            {/* 4-Way Studio Mode Switcher */}
            <div className="bg-muted p-0.5 rounded-lg flex flex-wrap items-center border">
              <button
                type="button"
                onClick={() => {
                  setStudioMode("match");
                  setActiveSection("autonomous");
                  setSelectedComponent(null);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  studioMode === "match" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Match Scouting
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudioMode("pit");
                  setActiveSection("autonomous");
                  setSelectedComponent(null);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  studioMode === "pit" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pit Scouting
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudioMode("matchup");
                  setSelectedComponent(null);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                  studioMode === "matchup" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Swords className="h-3 w-3" /> Matchup Card
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudioMode("teampage");
                  setSelectedComponent(null);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                  studioMode === "teampage" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="h-3 w-3" /> Team Page
              </button>
            </div>

            {/* Viewport Frame Toggle (for Match/Pit Canvas) */}
            {(studioMode === "match" || studioMode === "pit") && (
              <div className="bg-muted p-0.5 rounded-lg hidden sm:flex items-center border">
                <button
                  type="button"
                  onClick={() => setViewportDevice("responsive")}
                  title="Full Responsive View"
                  className={`p-1.5 rounded-md ${viewportDevice === "responsive" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"}`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewportDevice("tablet")}
                  title="Tablet View (iPad)"
                  className={`p-1.5 rounded-md ${viewportDevice === "tablet" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"}`}
                >
                  <Tablet className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewportDevice("phone")}
                  title="Mobile Phone View"
                  className={`p-1.5 rounded-md ${viewportDevice === "phone" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"}`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Interactive Test Mode Toggle (for Match/Pit) */}
            {(studioMode === "match" || studioMode === "pit") && (
              <Button
                variant={isTestMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsTestMode(!isTestMode);
                  if (!isTestMode) setSelectedComponent(null);
                }}
                className={`h-9 text-xs transition-colors ${
                  isTestMode ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
              >
                {isTestMode ? (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1 fill-current" /> Testing Live
                  </>
                ) : (
                  <>
                    <MousePointer className="h-3.5 w-3.5 mr-1" /> Test Form
                  </>
                )}
              </Button>
            )}

            {/* Raw JSON Modal Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsJsonDialogOpen(true)}
              className="h-9 text-xs"
              title="Inspect & Edit Raw JSON"
            >
              <Code className="h-3.5 w-3.5 mr-1 text-orange-500" /> JSON
            </Button>

            {/* Save to Server */}
            <Button size="sm" onClick={handleSaveToServer} disabled={isSaving} className="h-9 text-xs">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isSaving ? "Saving..." : "Save Config"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Designer Workspace depending on active mode */}
      {studioMode === "match" || studioMode === "pit" ? (
        /* Figma-Style 3-Column Studio Workspace for Match/Pit */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Component Palette (2.5 cols) */}
          <div className="lg:col-span-3 h-[750px] sticky top-4">
            <ComponentPalette
              scoutingMode={studioMode}
              onAddComponent={(type) => handleAddComponent(type)}
            />
          </div>

          {/* Center Column: Direct Manipulation WYSIWYG Canvas (6 cols) */}
          <div className="lg:col-span-6 overflow-y-auto max-h-[850px] pr-1">
            <VisualCanvas
              config={currentConfig}
              year={currentYear}
              scoutingMode={studioMode}
              activeSection={activeSection}
              isTestMode={isTestMode}
              viewportDevice={viewportDevice}
              selectedComponent={selectedComponent}
              onSectionChange={setActiveSection}
              onSelectComponent={setSelectedComponent}
              onDuplicateComponent={handleDuplicateComponent}
              onDeleteComponent={handleDeleteComponent}
              onDropComponent={handleAddComponent}
              onReorderComponents={handleReorderComponents}
            />
          </div>

          {/* Right Column: Property Inspector (3.5 cols) */}
          <div className="lg:col-span-3 h-[750px] sticky top-4">
            <PropertyInspector
              config={currentConfig}
              year={currentYear}
              selectedComponent={selectedComponent}
              onUpdateConfig={setCurrentConfig}
              onUpdateYear={setCurrentYear}
              onSelectComponent={setSelectedComponent}
              onDuplicateComponent={handleDuplicateComponent}
              onDeleteComponent={handleDeleteComponent}
            />
          </div>
        </div>
      ) : studioMode === "matchup" ? (
        /* Matchup Card Designer */
        <VisualMatchupCanvas
          config={currentConfig}
          onUpdateConfig={setCurrentConfig}
        />
      ) : (
        /* Team Profile Page Designer */
        <VisualTeamPageCanvas
          config={currentConfig}
          onUpdateConfig={setCurrentConfig}
        />
      )}

      {/* Raw JSON Code Modal Dialog */}
      <Dialog open={isJsonDialogOpen} onOpenChange={setIsJsonDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              Raw Configuration Schema Inspector & Exporter
            </DialogTitle>
          </DialogHeader>
          <BuilderJsonEditor
            config={currentConfig}
            year={currentYear}
            onUpdateConfig={setCurrentConfig}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
