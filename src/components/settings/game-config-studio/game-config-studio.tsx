"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Save,
  Plus,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Trophy,
  Zap,
  ClipboardList,
  BarChart3,
  Eye,
  Code,
  CheckCircle2,
  FileJson,
} from "lucide-react";
import { toast } from "sonner";
import type { YearConfig } from "@/lib/types";
import { DEFAULT_NEW_CONFIG } from "./types";
import { BuilderGameInfo } from "./builder-game-info";
import { BuilderScoringSection } from "./builder-scoring-section";
import { BuilderPitScouting } from "./builder-pit-scouting";
import { BuilderInsightsMatchup } from "./builder-insights-matchup";
import { BuilderLivePreview } from "./builder-live-preview";
import { BuilderJsonEditor } from "./builder-json-editor";

// Static defaults as instant fallback while API loads
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("scoring");

  // Fetch available configs from API
  const fetchConfigs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/scouting/admin/configs");
      if (res.ok) {
        const data = await res.json();
        if (data.configs && data.configs.length > 0) {
          setConfigList(data.configs);
        }
      }
    } catch (err) {
      console.error("Failed to load configs from server:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Load selected config
  const handleSelectConfig = async (filename: string) => {
    setSelectedFile(filename);
    try {
      setIsLoading(true);
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
      // Fallback to static bundles if offline or API error
    } finally {
      setIsLoading(false);
    }

    // Static fallback
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
    setActiveTab("game-info");
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
    toast.info(`Duplicated configuration as ${cloned.competitionType}-${nextYear}`);
  };

  // Save to server
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

  return (
    <div className="space-y-6">
      {/* Studio Header & Top Action Bar */}
      <Card className="border-primary/20 bg-linear-to-r from-card via-card to-primary/5 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileJson className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-bold tracking-tight">
                  Game Config Studio
                </CardTitle>
                <Badge variant="outline" className="text-xs uppercase bg-primary/10 text-primary border-primary/30">
                  Admin Tool
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Visual UI builder to create, edit, customize, and preview JSON game scoring rules and pit scouting forms.
              </CardDescription>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedFile} onValueChange={handleSelectConfig}>
                <SelectTrigger className="w-48 h-9 text-xs font-medium">
                  <SelectValue placeholder="Select Configuration" />
                </SelectTrigger>
                <SelectContent>
                  {configList.map((cfg) => (
                    <SelectItem key={cfg.filename} value={cfg.filename}>
                      {cfg.competitionType} {cfg.year} ({cfg.gameName || cfg.filename})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={handleCreateNew}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New
              </Button>

              <Button variant="outline" size="sm" onClick={handleDuplicateCurrent}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
              </Button>

              <Button size="sm" onClick={handleSaveToServer} disabled={isSaving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {isSaving ? "Saving..." : "Save Config"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Studio Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto p-1 gap-1">
          <TabsTrigger value="game-info" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>Game Info</span>
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
            <Zap className="h-4 w-4 text-blue-500" />
            <span>Match Scoring</span>
          </TabsTrigger>
          <TabsTrigger value="pit" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
            <ClipboardList className="h-4 w-4 text-emerald-500" />
            <span>Pit Scouting</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 text-purple-500" />
            <span>Analytics & UI</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
            <Eye className="h-4 w-4 text-pink-500" />
            <span>Live Preview</span>
          </TabsTrigger>
          <TabsTrigger value="json" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
            <Code className="h-4 w-4 text-orange-500" />
            <span>Raw JSON</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Game Info */}
        <TabsContent value="game-info" className="space-y-4 pt-4">
          <BuilderGameInfo
            config={currentConfig}
            year={currentYear}
            onUpdateConfig={setCurrentConfig}
            onUpdateYear={setCurrentYear}
          />
        </TabsContent>

        {/* Tab 2: Match Scoring */}
        <TabsContent value="scoring" className="space-y-4 pt-4">
          <BuilderScoringSection
            config={currentConfig}
            onUpdateConfig={setCurrentConfig}
          />
        </TabsContent>

        {/* Tab 3: Pit Scouting */}
        <TabsContent value="pit" className="space-y-4 pt-4">
          <BuilderPitScouting
            config={currentConfig}
            onUpdateConfig={setCurrentConfig}
          />
        </TabsContent>

        {/* Tab 4: Analytics & Visual Cards */}
        <TabsContent value="analytics" className="space-y-4 pt-4">
          <BuilderInsightsMatchup
            config={currentConfig}
            onUpdateConfig={setCurrentConfig}
          />
        </TabsContent>

        {/* Tab 5: Live Form Preview */}
        <TabsContent value="preview" className="space-y-4 pt-4">
          <BuilderLivePreview config={currentConfig} />
        </TabsContent>

        {/* Tab 6: Raw JSON Editor */}
        <TabsContent value="json" className="space-y-4 pt-4">
          <BuilderJsonEditor
            config={currentConfig}
            year={currentYear}
            onUpdateConfig={setCurrentConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
