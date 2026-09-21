"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { teamApi } from "@/lib/api/database-client";
import type { TeamData } from "@/lib/types";
import { useMatchScheduleTeams } from "@/hooks/use-match-schedule-teams";
import { useGameConfig } from "@/hooks/use-game-config";
import { useSelectedEvent } from "@/hooks/use-event-config";
import MatchupAlliancePanel from "./matchup-alliance-panel";

type MatchType = "qualification" | "playoff";

export default function MatchupPage() {
  const { currentYear, competitionType } = useGameConfig();
  const selectedEvent = useSelectedEvent();
  const {
    scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
    hasScheduleData,
    maxMatchNumber,
    getTeamsForMatch,
    refreshSchedule,
  } = useMatchScheduleTeams();

  const [matchNumber, setMatchNumber] = useState<number>(1);
  const [matchNumberInput, setMatchNumberInput] = useState("1");
  const [matchType, setMatchType] = useState<MatchType>("qualification");
  const [manualTeams, setManualTeams] = useState<{
    red: string[];
    blue: string[];
  }>({
    red: ["", "", ""],
    blue: ["", "", ""],
  });
  const [useManual, setUseManual] = useState(false);

  // Get teams for the current match from schedule
  const scheduleTeams = hasScheduleData ? getTeamsForMatch(matchNumber) : [];
  const redTeams = scheduleTeams
    .filter((t) => t.alliance === "red")
    .sort((a, b) => a.position - b.position);
  const blueTeams = scheduleTeams
    .filter((t) => t.alliance === "blue")
    .sort((a, b) => a.position - b.position);

  // Determine which teams to display
  const displayRedTeams: number[] = useManual
    ? manualTeams.red.map((t) => parseInt(t)).filter((n) => !isNaN(n) && n > 0)
    : redTeams.map((t) => t.teamNumber);
  const displayBlueTeams: number[] = useManual
    ? manualTeams.blue.map((t) => parseInt(t)).filter((n) => !isNaN(n) && n > 0)
    : blueTeams.map((t) => t.teamNumber);

  const hasTeams = displayRedTeams.length > 0 || displayBlueTeams.length > 0;

  // FTC has 2 robots per alliance, FRC has 3
  const allianceSize = competitionType === "FTC" ? 2 : 3;

  // EPA data for all displayed teams
  const [teamEpaMap, setTeamEpaMap] = useState<
    Record<
      number,
      {
        epa: number;
        auto: number;
        teleop: number;
        endgame: number;
        matchCount: number;
      } | null
    >
  >({});
  const [epaLoading, setEpaLoading] = useState(false);

  // Stable key to detect when displayed teams change
  const allTeamsKey = useMemo(
    () => [...displayRedTeams, ...displayBlueTeams].sort().join(","),
    [displayRedTeams, displayBlueTeams],
  );

  // Fetch EPA data for all displayed teams
  useEffect(() => {
    const allTeams = [...displayRedTeams, ...displayBlueTeams];
    if (allTeams.length === 0) {
      setTeamEpaMap({});
      return;
    }

    let cancelled = false;
    setEpaLoading(true);

    Promise.all(
      allTeams.map(async (teamNum) => {
        try {
          const data: TeamData = await teamApi.getTeamData(
            teamNum,
            currentYear,
            selectedEvent?.eventCode,
            competitionType,
          );
          // API returns autoEPA/teleopEPA/endgameEPA (not auto/teleop/endgame)
          const epa = data.epa as Record<string, number> | null;
          return {
            teamNum,
            epa: epa?.totalEPA ?? 0,
            auto: epa?.autoEPA ?? 0,
            teleop: epa?.teleopEPA ?? 0,
            endgame: epa?.endgameEPA ?? 0,
            matchCount: data.matchCount ?? 0,
          };
        } catch {
          return {
            teamNum,
            epa: 0,
            auto: 0,
            teleop: 0,
            endgame: 0,
            matchCount: 0,
          };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const map: typeof teamEpaMap = {};
      results.forEach((r) => {
        map[r.teamNum] = {
          epa: r.epa,
          auto: r.auto,
          teleop: r.teleop,
          endgame: r.endgame,
          matchCount: r.matchCount,
        };
      });
      setTeamEpaMap(map);
      setEpaLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTeamsKey, currentYear, selectedEvent?.eventCode, competitionType]);

  // Calculate alliance totals
  const redTotalEpa = displayRedTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.epa ?? 0),
    0,
  );
  const blueTotalEpa = displayBlueTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.epa ?? 0),
    0,
  );
  const redAutoEpa = displayRedTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.auto ?? 0),
    0,
  );
  const blueAutoEpa = displayBlueTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.auto ?? 0),
    0,
  );
  const redTeleopEpa = displayRedTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.teleop ?? 0),
    0,
  );
  const blueTeleopEpa = displayBlueTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.teleop ?? 0),
    0,
  );
  const redEndgameEpa = displayRedTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.endgame ?? 0),
    0,
  );
  const blueEndgameEpa = displayBlueTeams.reduce(
    (sum, t) => sum + (teamEpaMap[t]?.endgame ?? 0),
    0,
  );

  const epaReady =
    hasTeams && !epaLoading && Object.keys(teamEpaMap).length > 0;
  const epaDiff = Math.abs(redTotalEpa - blueTotalEpa);
  const expectedWinner: "red" | "blue" | "toss-up" = !epaReady
    ? "toss-up"
    : epaDiff < 2
      ? "toss-up"
      : redTotalEpa > blueTotalEpa
        ? "red"
        : "blue";

  const handlePrevMatch = useCallback(() => {
    setMatchNumber((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextMatch = useCallback(() => {
    setMatchNumber((prev) =>
      maxMatchNumber ? Math.min(maxMatchNumber, prev + 1) : prev + 1,
    );
  }, [maxMatchNumber]);

  useEffect(() => {
    setMatchNumberInput(matchNumber.toString());
  }, [matchNumber]);

  const updateManualTeam = (
    alliance: "red" | "blue",
    index: number,
    value: string,
  ) => {
    setManualTeams((prev) => {
      const newTeams = { ...prev };
      newTeams[alliance] = [...prev[alliance]];
      newTeams[alliance][index] = value;
      return newTeams;
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Match Preview</h1>
            <p className="text-muted-foreground">
              Compare both alliances side by side before the match.
            </p>
          </div>
        </div>
      </div>

      {/* Match Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Match Selection</CardTitle>
          <CardDescription>
            Choose a match from the schedule or manually enter team numbers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Source toggle */}
            <div className="flex items-center gap-3 -mt-6">
              <Button
                variant={!useManual ? "default" : "outline"}
                size="sm"
                onClick={() => setUseManual(false)}
                disabled={!hasScheduleData}
              >
                From Schedule
              </Button>
              <Button
                variant={useManual ? "default" : "outline"}
                size="sm"
                onClick={() => setUseManual(true)}
              >
                Manual Entry
              </Button>
            </div>

            {!useManual ? (
              /* Schedule-based selector */
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label>Match Type</Label>
                  <Select
                    value={matchType}
                    onValueChange={(v) => setMatchType(v as MatchType)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="qualification">
                        Qualification
                      </SelectItem>
                      <SelectItem value="playoff">Playoff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Match #</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={handlePrevMatch}
                      disabled={matchNumber <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={maxMatchNumber || undefined}
                      value={matchNumberInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMatchNumberInput(value);

                        const parsed = parseInt(value, 10);
                        if (!Number.isNaN(parsed)) {
                          const clamped = maxMatchNumber
                            ? Math.min(maxMatchNumber, Math.max(1, parsed))
                            : Math.max(1, parsed);
                          setMatchNumber(clamped);
                        }
                      }}
                      onBlur={() => {
                        if (matchNumberInput.trim() === "") {
                          setMatchNumberInput(matchNumber.toString());
                        }
                      }}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={handleNextMatch}
                      disabled={
                        !!maxMatchNumber && matchNumber >= maxMatchNumber
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {maxMatchNumber > 0 && (
                      <span className="text-sm text-muted-foreground ml-2">
                        of {maxMatchNumber}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={refreshSchedule}
                  title="Refresh schedule"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>

                {scheduleLoading && (
                  <span className="text-sm text-muted-foreground">
                    Loading schedule...
                  </span>
                )}
                {scheduleError && (
                  <span className="text-sm text-destructive">
                    {scheduleError}
                  </span>
                )}
                {!hasScheduleData && !scheduleLoading && (
                  <span className="text-sm text-muted-foreground">
                    No schedule available — select an event or use manual entry
                  </span>
                )}
              </div>
            ) : (
              /* Manual team entry */
              <div className="grid md:grid-cols-2 gap-6">
                {/* Red alliance manual */}
                <div className="space-y-2">
                  <Label className="text-red-600 dark:text-red-400 font-semibold">
                    Red Alliance
                  </Label>
                  {Array.from({ length: allianceSize }).map((_, i) => (
                    <Input
                      key={`red-${i}`}
                      type="number"
                      placeholder={`Red ${i + 1} team number`}
                      value={manualTeams.red[i]}
                      onChange={(e) =>
                        updateManualTeam("red", i, e.target.value)
                      }
                    />
                  ))}
                </div>
                {/* Blue alliance manual */}
                <div className="space-y-2">
                  <Label className="text-blue-600 dark:text-blue-400 font-semibold">
                    Blue Alliance
                  </Label>
                  {Array.from({ length: allianceSize }).map((_, i) => (
                    <Input
                      key={`blue-${i}`}
                      type="number"
                      placeholder={`Blue ${i + 1} team number`}
                      value={manualTeams.blue[i]}
                      onChange={(e) =>
                        updateManualTeam("blue", i, e.target.value)
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alliance Matchup Display */}
      {hasTeams ? (
        <div className="space-y-4">
          {/* Match Header */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-red-500" />
              <span className="font-semibold text-red-600 dark:text-red-400">
                Red Alliance
              </span>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-1">
              {matchType === "qualification" ? "Qual" : "Playoff"} Match{" "}
              {matchNumber}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-600 dark:text-blue-400 text-right">
                Blue Alliance
              </span>
              <div className="h-4 w-4 rounded-full bg-blue-500" />
            </div>
          </div>

          {/* EPA Prediction Summary */}
          <Card>
            <CardContent className="py-4">
              {epaLoading ? (
                <div className="flex items-center justify-center gap-4 py-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-10 w-40" />
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : epaReady ? (
                <div className="space-y-3">
                  {/* Expected Winner Banner */}
                  <div className="flex items-center justify-center gap-3">
                    <Trophy
                      className={`h-5 w-5 ${
                        expectedWinner === "red"
                          ? "text-red-500"
                          : expectedWinner === "blue"
                            ? "text-blue-500"
                            : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium text-muted-foreground">
                      Expected Winner:
                    </span>
                    <Badge
                      variant={
                        expectedWinner === "toss-up" ? "secondary" : "default"
                      }
                      className={`text-sm px-3 py-1 ${
                        expectedWinner === "red"
                          ? "bg-red-500 hover:bg-red-600 text-white"
                          : expectedWinner === "blue"
                            ? "bg-blue-500 hover:bg-blue-600 text-white"
                            : ""
                      }`}
                    >
                      {expectedWinner === "red"
                        ? "Red Alliance"
                        : expectedWinner === "blue"
                          ? "Blue Alliance"
                          : "Toss-up"}
                    </Badge>
                    {expectedWinner !== "toss-up" && (
                      <span className="text-xs text-muted-foreground">
                        by {epaDiff.toFixed(1)} EPA
                      </span>
                    )}
                  </div>

                  {/* EPA Comparison Bar */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    {/* Red EPA */}
                    <div className="text-right space-y-1">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {redTotalEpa.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total EPA
                      </div>
                    </div>

                    {/* VS divider */}
                    <div className="flex flex-col items-center">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        VS
                      </span>
                    </div>

                    {/* Blue EPA */}
                    <div className="text-left space-y-1">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {blueTotalEpa.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total EPA
                      </div>
                    </div>
                  </div>

                  {/* Phase Breakdown */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-sm">
                    <div className="text-right space-y-1">
                      <div className="flex justify-end gap-3">
                        <span className="text-muted-foreground">Auto</span>
                        <span
                          className={`font-medium tabular-nums ${redAutoEpa > blueAutoEpa ? "text-red-600 dark:text-red-400 font-bold" : ""}`}
                        >
                          {redAutoEpa.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-end gap-3">
                        <span className="text-muted-foreground">Teleop</span>
                        <span
                          className={`font-medium tabular-nums ${redTeleopEpa > blueTeleopEpa ? "text-red-600 dark:text-red-400 font-bold" : ""}`}
                        >
                          {redTeleopEpa.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-end gap-3">
                        <span className="text-muted-foreground">Endgame</span>
                        <span
                          className={`font-medium tabular-nums ${redEndgameEpa > blueEndgameEpa ? "text-red-600 dark:text-red-400 font-bold" : ""}`}
                        >
                          {redEndgameEpa.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <Separator orientation="vertical" className="h-16" />

                    <div className="text-left space-y-1">
                      <div className="flex gap-3">
                        <span
                          className={`font-medium tabular-nums ${blueAutoEpa > redAutoEpa ? "text-blue-600 dark:text-blue-400 font-bold" : ""}`}
                        >
                          {blueAutoEpa.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">Auto</span>
                      </div>
                      <div className="flex gap-3">
                        <span
                          className={`font-medium tabular-nums ${blueTeleopEpa > redTeleopEpa ? "text-blue-600 dark:text-blue-400 font-bold" : ""}`}
                        >
                          {blueTeleopEpa.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">Teleop</span>
                      </div>
                      <div className="flex gap-3">
                        <span
                          className={`font-medium tabular-nums ${blueEndgameEpa > redEndgameEpa ? "text-blue-600 dark:text-blue-400 font-bold" : ""}`}
                        >
                          {blueEndgameEpa.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">Endgame</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-2">
                  No EPA data available for prediction
                </p>
              )}
            </CardContent>
          </Card>

          {/* Alliance panels side by side */}
          <div className="grid lg:grid-cols-2 gap-6">
            <MatchupAlliancePanel
              alliance="red"
              teamNumbers={displayRedTeams}
              currentYear={currentYear}
              competitionType={competitionType}
            />
            <MatchupAlliancePanel
              alliance="blue"
              teamNumbers={displayBlueTeams}
              currentYear={currentYear}
              competitionType={competitionType}
            />
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Teams Selected</h3>
            <p className="text-muted-foreground max-w-md">
              {hasScheduleData
                ? "Choose a match number above to preview both alliances."
                : "Load a schedule by selecting an event, or use manual entry to input team numbers."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
