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
import { Trophy, MapPin, Plus, X } from "lucide-react";
import type { YearConfig, CompetitionType } from "@/lib/types";

interface BuilderGameInfoProps {
  config: YearConfig;
  year: number;
  onUpdateConfig: (updater: (prev: YearConfig) => YearConfig) => void;
  onUpdateYear: (year: number) => void;
}

export function BuilderGameInfo({
  config,
  year,
  onUpdateConfig,
  onUpdateYear,
}: BuilderGameInfoProps) {
  const [newPosition, setNewPosition] = useState("");

  const handleAddPosition = () => {
    const trimmed = newPosition.trim();
    if (!trimmed) return;
    const currentPositions = config.startPositions || [];
    if (!currentPositions.includes(trimmed)) {
      onUpdateConfig((prev) => ({
        ...prev,
        startPositions: [...(prev.startPositions || []), trimmed],
      }));
    }
    setNewPosition("");
  };

  const handleRemovePosition = (indexToRemove: number) => {
    onUpdateConfig((prev) => ({
      ...prev,
      startPositions: (prev.startPositions || []).filter((_, i) => i !== indexToRemove),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddPosition();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-primary" />
            Basic Game Information
          </CardTitle>
          <CardDescription>
            Configure the competition format, game title, and season year for this JSON configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comp-type">Competition Program</Label>
              <Select
                value={config.competitionType || "FRC"}
                onValueChange={(val: CompetitionType) =>
                  onUpdateConfig((prev) => ({ ...prev, competitionType: val }))
                }
              >
                <SelectTrigger id="comp-type">
                  <SelectValue placeholder="Select Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FRC">FRC (FIRST Robotics Competition)</SelectItem>
                  <SelectItem value="FTC">FTC (FIRST Tech Challenge)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="game-year">Game Season / Year</Label>
              <Input
                id="game-year"
                type="number"
                value={year || ""}
                onChange={(e) => onUpdateYear(parseInt(e.target.value, 10) || 0)}
                placeholder="2027"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="game-name">Game Name</Label>
              <Input
                id="game-name"
                value={config.gameName || ""}
                onChange={(e) =>
                  onUpdateConfig((prev) => ({ ...prev, gameName: e.target.value }))
                }
                placeholder="e.g. REEFSCAPE or REBUILT"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Field Starting Positions
          </CardTitle>
          <CardDescription>
            Define the starting zone positions scouters can pick during match scouting autonomous.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Left Trench, Subwoofer, Hub, Far Zone..."
              className="max-w-md"
            />
            <Button type="button" variant="secondary" onClick={handleAddPosition}>
              <Plus className="h-4 w-4 mr-1" /> Add Position
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {(config.startPositions || []).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No starting positions defined. Default Left / Center / Right will be used.
              </p>
            ) : (
              (config.startPositions || []).map((pos, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="px-3 py-1 text-sm flex items-center gap-1.5 bg-muted/50 border-border"
                >
                  <span>{pos}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePosition(idx)}
                    className="text-muted-foreground hover:text-destructive rounded-full p-0.5 focus:outline-none"
                    title={`Remove ${pos}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
