"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoringField } from "./scoring-field";
import type { ScoringDefinition, DynamicMatchData } from "@/lib/types";
import { encodeStartPosition } from "./match-form-utils";
interface ScoringSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  section: "autonomous" | "teleop" | "endgame" | "fouls";
  scoringConfig: Record<string, ScoringDefinition>;
  formData: DynamicMatchData;
  gameConfig?: any;
  showStartPosition?: boolean;
  onInputChange: (
    section: string,
    field: string,
    value: number | string | boolean,
  ) => void;
  onNumberChange: (section: string, field: string, increment: boolean) => void;
}

export function ScoringSection({
  title,
  description,
  icon,
  section,
  scoringConfig,
  formData,
  gameConfig,
  showStartPosition = false,
  onInputChange,
  onNumberChange,
}: ScoringSectionProps) {
  return (
    <Card className="border rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary/90">
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {showStartPosition && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Starting Position</Label>
              <Select
                value={String(
                  (formData.autonomous as Record<string, unknown>)
                    .startPosition || "",
                )}
                onValueChange={(value) =>
                  onInputChange("autonomous", "startPosition", value)
                }
              >
                <SelectTrigger className="focus:border-green-500 w-full">
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {gameConfig?.startPositions &&
                  gameConfig.startPositions.length > 0 ? (
                    gameConfig.startPositions.map((position: string) => (
                      <SelectItem
                        key={encodeStartPosition(position)}
                        value={encodeStartPosition(position)}
                      >
                        {position}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-6">
          {Object.entries(scoringConfig)
            .filter(([key, config]) => {
              if (!config.dependsOn) return true;
              const dependencyValue = (
                formData[section] as Record<string, number | string | boolean>
              )[config.dependsOn];
              return Boolean(dependencyValue);
            })
            .map(([key, config]) => (
              <ScoringField
                key={key}
                section={section}
                fieldKey={key}
                fieldConfig={config}
                currentValue={
                  (
                    formData[section] as Record<
                      string,
                      number | string | boolean
                    >
                  )[key]
                }
                onValueChange={onInputChange}
                onNumberChange={onNumberChange}
              />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
