"use client";

import { useSession } from "next-auth/react";
import { GuestMatchSchedule } from "@/components/events/guest-match-schedule";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  Users,
  Handshake,
  Loader2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  UserRound,
  ChevronRight,
} from "lucide-react";
import { useScheduleData } from "@/hooks/use-schedule-data";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { toast } from "sonner";
import { MatchAssignmentRow, ActiveScoutCheckbox } from "@/components/schedule/schedule-rows";
import { autoAssignMatches, computeUserWorkload, hasPreferredPartnerInMatch as hasPartnerInMatch, type UserWithPartners, type DisplayBlock, type MatchAssignment } from "@/lib/schedule/assignments";

export default function SchedulePage() {
  const { data: session, status } = useSession();
  if (status === "loading") return <p>Loading schedule…</p>;
  return session?.guestEvent ? <GuestMatchSchedule /> : <ScoutSchedulePage />;
}

function ScoutSchedulePage() {
  const {
    users,
    blocks: dbBlocks,
    matchAssignments,
    blockSize,
    setBlockSize,
    matchCount,
    setManualMatchCount,
    apiMatchCount,
    isApiMatchCountAvailable,
    competitionType,
    scheduleScopeKey,
    isLoading,
    error,
    hasEvent,
    generateBlocks,
    syncMatchCountFromApi,
    replaceAllAssignments,
    deleteAllBlocks,
    refreshData,
  } = useScheduleData();

  const scoutsPerAlliance = competitionType === "FTC" ? 2 : 3;

  const [activeScouts, setActiveScouts] = useState<string[]>([]);
  const [isGeneratingBlocks, setIsGeneratingBlocks] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingMatchCount, setIsSyncingMatchCount] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showGroupTemplates, setShowGroupTemplates] = useState(false);
  const [matchQuery, setMatchQuery] = useState("");
  const [scoutFilter, setScoutFilter] = useState("all");
  const [onlyOpenSlots, setOnlyOpenSlots] = useState(false);

  const clearFilters = () => {
    setMatchQuery("");
    setScoutFilter("all");
    setOnlyOpenSlots(false);
  };

  const [filterScope, setFilterScope] = useState(scheduleScopeKey);
  if (filterScope !== scheduleScopeKey) {
    setFilterScope(scheduleScopeKey);
    setMatchQuery("");
    setScoutFilter("all");
    setOnlyOpenSlots(false);
  }

  const [manualMatchInput, setManualMatchInput] = useState<string>("");
  const [localMatches, setLocalMatches] = useState<MatchAssignment[]>([]);
  const [lastSyncedFingerprint, setLastSyncedFingerprint] = useState("");

  const blocks = useMemo<DisplayBlock[]>(() => {
    return dbBlocks.map((block) => ({
      id: block.id,
      name: `Virtual Group ${block.blockNumber}`,
      blockNumber: block.blockNumber,
      matches: Array.from(
        { length: block.endMatch - block.startMatch + 1 },
        (_, i) => block.startMatch + i,
      ),
    }));
  }, [dbBlocks]);

  const sortedUsers = useMemo<UserWithPartners[]>(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const usersById = useMemo(
    () => new Map(sortedUsers.map((user) => [user.id, user])),
    [sortedUsers],
  );
  const activeScoutSet = useMemo(() => new Set(activeScouts), [activeScouts]);
  const sortedActiveUsers = useMemo<UserWithPartners[]>(() => {
    return sortedUsers.filter((user) => activeScoutSet.has(user.id));
  }, [sortedUsers, activeScoutSet]);

  const buildInitialMatches = useCallback((): MatchAssignment[] => {
    const initial: MatchAssignment[] = Array.from(
      { length: matchCount },
      (_, i) => ({
        matchNumber: i + 1,
        redScouts: Array(scoutsPerAlliance).fill(null),
        blueScouts: Array(scoutsPerAlliance).fill(null),
      }),
    );

    matchAssignments.forEach((row) => {
      if (row.matchNumber < 1 || row.matchNumber > matchCount) return;
      if (row.position < 0 || row.position >= scoutsPerAlliance) return;
      const target = initial[row.matchNumber - 1];
      if (row.alliance === "red") target.redScouts[row.position] = row.userId;
      else target.blueScouts[row.position] = row.userId;
    });

    return initial;
  }, [matchCount, scoutsPerAlliance, matchAssignments]);

  // Rebuild the local editing copy whenever the saved assignments change.
  // Done during render so stale matches from the previous event never show.
  const hasSchedule = hasEvent && matchCount > 0;
  const syncFingerprint = useMemo(
    () =>
      hasSchedule
        ? JSON.stringify({
            scheduleScopeKey,
            matchCount,
            scoutsPerAlliance,
            rows: matchAssignments,
          })
        : "",
    [hasSchedule, scheduleScopeKey, matchCount, scoutsPerAlliance, matchAssignments],
  );
  if (syncFingerprint !== lastSyncedFingerprint) {
    setLastSyncedFingerprint(syncFingerprint);
    if (!hasSchedule) {
      setLocalMatches([]);
    } else {
      setLocalMatches(buildInitialMatches());

      const assignedScoutIds = new Set<string>();
      matchAssignments.forEach((row) => {
        if (row.userId) assignedScoutIds.add(row.userId);
      });
      setActiveScouts(Array.from(assignedScoutIds));
    }
  }

  const matchesByNumber = useMemo(() => {
    const map = new Map<number, MatchAssignment>();
    localMatches.forEach((match) => map.set(match.matchNumber, match));
    return map;
  }, [localMatches]);

  const hasUnsavedChanges = useMemo(() => {
    if (
      matchAssignments.some(
        (row) =>
          row.matchNumber < 1 ||
          row.matchNumber > matchCount ||
          row.position < 0 ||
          row.position >= scoutsPerAlliance,
      )
    ) {
      return true;
    }
    const dbMap = new Map<string, string | null>();
    matchAssignments.forEach((row) =>
      dbMap.set(
        `${row.matchNumber}-${row.alliance}-${row.position}`,
        row.userId,
      ),
    );

    for (const match of localMatches) {
      for (let pos = 0; pos < scoutsPerAlliance; pos++) {
        const dbRed = dbMap.get(`${match.matchNumber}-red-${pos}`) ?? null;
        const dbBlue = dbMap.get(`${match.matchNumber}-blue-${pos}`) ?? null;
        if ((match.redScouts[pos] ?? null) !== dbRed) return true;
        if ((match.blueScouts[pos] ?? null) !== dbBlue) return true;
      }
    }

    return false;
  }, [localMatches, matchAssignments, scoutsPerAlliance, matchCount]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const visibleMatches = useMemo(() => localMatches.filter((match) => {
    const scouts = [...match.redScouts, ...match.blueScouts];
    return (!matchQuery.trim() || String(match.matchNumber) === matchQuery.trim())
      && (scoutFilter === "all" || scouts.includes(scoutFilter))
      && (!onlyOpenSlots || scouts.some((scout) => !scout));
  }), [localMatches, matchQuery, scoutFilter, onlyOpenSlots]);

  const workloadMap = useMemo(
    () => computeUserWorkload(localMatches, sortedUsers),
    [localMatches, sortedUsers],
  );
  const hasPreferredPartnerInMatch = useCallback(
    (userId: string, match: MatchAssignment) => hasPartnerInMatch(userId, match, usersById),
    [usersById],
  );

  const scheduleSummary = useMemo(() => {
    let totalAssigned = 0;
    let unassigned = 0;
    let preferredPairHits = 0;
    const assignedScoutIds = new Set<string>();

    localMatches.forEach((match) => {
      [...match.redScouts, ...match.blueScouts].forEach((scoutId) => {
        if (scoutId) {
          totalAssigned++;
          assignedScoutIds.add(scoutId);
          if (hasPreferredPartnerInMatch(scoutId, match)) preferredPairHits++;
        } else {
          unassigned++;
        }
      });
    });

    return {
      totalAssigned,
      unassigned,
      activeAssignedCount: assignedScoutIds.size,
      preferredPairings: Math.floor(preferredPairHits / 2),
    };
  }, [localMatches, hasPreferredPartnerInMatch]);

  const workloadList = useMemo(() => {
    return sortedUsers
      .map((user) => ({
        user,
        matchesAssigned: workloadMap.get(user.id) ?? 0,
        isActive: activeScoutSet.has(user.id),
      }))
      .sort((a, b) => b.matchesAssigned - a.matchesAssigned);
  }, [sortedUsers, workloadMap, activeScoutSet]);

  const toggleActiveScout = useCallback((scoutId: string, checked: boolean) => {
    setActiveScouts((prev) =>
      checked ? [...prev, scoutId] : prev.filter((id) => id !== scoutId),
    );
  }, []);

  const setLocalMatchScout = useCallback(
    (
      matchNumber: number,
      alliance: "red" | "blue",
      position: number,
      scoutId: string | null,
    ) => {
      setLocalMatches((prev) =>
        prev.map((match) => {
          if (match.matchNumber !== matchNumber) return match;
          const updated = {
            ...match,
            redScouts: [...match.redScouts],
            blueScouts: [...match.blueScouts],
          };
          if (alliance === "red") updated.redScouts[position] = scoutId;
          else updated.blueScouts[position] = scoutId;
          return updated;
        }),
      );
    },
    [],
  );

  const getAvailableUsersForMatchSlot = useCallback(
    (match: MatchAssignment, alliance: "red" | "blue", position: number) => {
      const assignedIds = new Set<string>();
      match.redScouts.forEach((scoutId, idx) => {
        if (scoutId && !(alliance === "red" && idx === position))
          assignedIds.add(scoutId);
      });
      match.blueScouts.forEach((scoutId, idx) => {
        if (scoutId && !(alliance === "blue" && idx === position))
          assignedIds.add(scoutId);
      });
      return sortedUsers.filter((user) => !assignedIds.has(user.id));
    },
    [sortedUsers],
  );

  const applyGroupSlot = useCallback(
    (
      block: DisplayBlock,
      alliance: "red" | "blue",
      position: number,
      scoutId: string | null,
    ) => {
      const groupMatchNumbers = new Set(block.matches);
      setLocalMatches((prev) =>
        prev.map((match) => {
          if (!groupMatchNumbers.has(match.matchNumber)) return match;
          const next = {
            ...match,
            redScouts: [...match.redScouts],
            blueScouts: [...match.blueScouts],
          };
          const targetSlots =
            alliance === "red" ? next.redScouts : next.blueScouts;

          if (scoutId === null) {
            targetSlots[position] = null;
            return next;
          }

          const assignedInMatch = new Set<string>([
            ...next.redScouts.filter((s): s is string => s !== null),
            ...next.blueScouts.filter((s): s is string => s !== null),
          ]);
          const currentAtSlot = targetSlots[position];
          if (currentAtSlot) assignedInMatch.delete(currentAtSlot);

          if (!assignedInMatch.has(scoutId)) targetSlots[position] = scoutId;
          return next;
        }),
      );
    },
    [],
  );

  const getGroupSlotValue = useCallback(
    (
      block: DisplayBlock,
      alliance: "red" | "blue",
      position: number,
    ): string | null | "mixed" => {
      let value: string | null | undefined = undefined;
      for (const matchNumber of block.matches) {
        const match = matchesByNumber.get(matchNumber);
        if (!match) continue;
        const slotValue =
          alliance === "red"
            ? match.redScouts[position]
            : match.blueScouts[position];
        if (value === undefined) value = slotValue;
        else if (value !== slotValue) return "mixed";
      }
      return value ?? null;
    },
    [matchesByNumber],
  );

  const autoAssignAllMatches = useCallback(() => {
    if (sortedActiveUsers.length === 0) {
      toast.error("Select active scouts first");
      return;
    }

    setIsAutoAssigning(true);
    try {
      const draft = autoAssignMatches(localMatches, blocks, sortedActiveUsers, scoutsPerAlliance);
      setLocalMatches(draft);
      const unfilled = draft.reduce(
        (count, match) =>
          count + [...match.redScouts, ...match.blueScouts].filter((id) => !id).length,
        0,
      );
      if (unfilled > 0) {
        toast.warning(`Auto-fill completed with ${unfilled} unfilled slots`);
      } else {
        toast.success("Auto-assigned all matches using virtual groups");
      }
    } catch (err) {
      console.error("Error auto-assigning matches:", err);
      toast.error("Failed to auto-assign matches");
    } finally {
      setIsAutoAssigning(false);
    }
  }, [
    sortedActiveUsers,
    scoutsPerAlliance,
    blocks,
    localMatches,
  ]);

  const clearAssignments = useCallback(() => {
    setLocalMatches((prev) =>
      prev.map((match) => ({
        ...match,
        redScouts: match.redScouts.map(() => null),
        blueScouts: match.blueScouts.map(() => null),
      })),
    );
    toast.success("All match assignments cleared");
  }, []);

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      const changes: Array<{
        startMatch: number;
        endMatch: number;
        alliance: "red" | "blue";
        position: number;
        userId: string | null;
      }> = [];
      localMatches.forEach((match) => {
        for (let pos = 0; pos < scoutsPerAlliance; pos++) {
          if (match.redScouts[pos]) {
            changes.push({
              startMatch: match.matchNumber,
              endMatch: match.matchNumber,
              alliance: "red",
              position: pos,
              userId: match.redScouts[pos],
            });
          }
          if (match.blueScouts[pos]) {
            changes.push({
              startMatch: match.matchNumber,
              endMatch: match.matchNumber,
              alliance: "blue",
              position: pos,
              userId: match.blueScouts[pos],
            });
          }
        }
      });
      const grouped = new Map<string, number[]>();
      changes.forEach((change) => {
        const key = `${change.alliance}|${change.position}|${change.userId}`;
        grouped.set(key, [...(grouped.get(key) ?? []), change.startMatch]);
      });
      const compacted: typeof changes = [];
      grouped.forEach((matchNumbers, key) => {
        const [alliance, positionRaw, userId] = key.split("|");
        const sorted = matchNumbers.sort((a, b) => a - b);
        let start = sorted[0];
        let end = sorted[0];
        for (const matchNumber of sorted.slice(1)) {
          if (matchNumber === end + 1) {
            end = matchNumber;
          } else {
            compacted.push({
              startMatch: start,
              endMatch: end,
              alliance: alliance as "red" | "blue",
              position: Number(positionRaw),
              userId,
            });
            start = matchNumber;
            end = matchNumber;
          }
        }
        compacted.push({
          startMatch: start,
          endMatch: end,
          alliance: alliance as "red" | "blue",
          position: Number(positionRaw),
          userId,
        });
      });
      await replaceAllAssignments(compacted);
      refreshData();
      toast.success("Changes saved");
    } catch (err) {
      console.error("Error saving changes:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save changes",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    setLocalMatches(buildInitialMatches());
  };

  const handleSetManualMatchCount = async () => {
    const count = parseInt(manualMatchInput);
    if (!isNaN(count) && count > 0 && count <= 200) {
      setManualMatchCount(count);
      setManualMatchInput("");
      toast.success(`Match count set to ${count}`);
      if (blocks.length > 0) {
        setIsGeneratingBlocks(true);
        try {
          await generateBlocks();
          toast.success(
            `Regenerated ${Math.ceil(count / blockSize)} virtual groups`,
          );
        } catch (err) {
          console.error("Error regenerating groups:", err);
          toast.error("Failed to regenerate groups");
        } finally {
          setIsGeneratingBlocks(false);
        }
      }
    } else {
      toast.error("Enter a valid number between 1 and 200");
    }
  };

  const handleSyncMatchCount = async () => {
    setIsSyncingMatchCount(true);
    try {
      const result = await syncMatchCountFromApi();
      if (result.success) {
        toast.success(`Match count updated to ${result.count}`);
        if (blocks.length > 0) {
          setIsGeneratingBlocks(true);
          try {
            await generateBlocks();
            toast.success(
              `Regenerated ${Math.ceil(result.count / blockSize)} virtual groups`,
            );
          } catch (err) {
            console.error("Error regenerating groups:", err);
            toast.error("Failed to regenerate groups");
          } finally {
            setIsGeneratingBlocks(false);
          }
        }
      } else {
        toast.error("Match schedule not yet available");
      }
    } catch (err) {
      console.error("Error syncing match count:", err);
      toast.error("Failed to sync match count");
    } finally {
      setIsSyncingMatchCount(false);
    }
  };

  const handleGenerateBlocks = async () => {
    if (matchCount <= 0) {
      toast.error("Set match count first");
      return;
    }

    setIsGeneratingBlocks(true);
    try {
      await generateBlocks();
      toast.success(
        `Generated ${Math.ceil(matchCount / blockSize)} virtual groups`,
      );
    } catch (err) {
      console.error("Error generating groups:", err);
      toast.error("Failed to generate groups");
    } finally {
      setIsGeneratingBlocks(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await deleteAllBlocks();
      setShowResetDialog(false);
      toast.success("Schedule reset");
    } catch (err) {
      console.error("Error resetting schedule:", err);
      toast.error("Failed to reset schedule");
    } finally {
      setIsResetting(false);
    }
  };

  const calculatedBlocks =
    matchCount > 0 && blockSize > 0 ? Math.ceil(matchCount / blockSize) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading schedule data...</p>
        </div>
      </div>
    );
  }

  if (!hasEvent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">
            Configure virtual groups and manage match assignments.
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select an event from the event switcher to manage the scouting
            schedule.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">
            Select scouts, fill assignments, then save your schedule.
          </p>
        </div>

      </div>

      {blocks.length === 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Matches Per Virtual Group</CardTitle>
              <CardDescription>
                Virtual groups are only templates for quick assignment ranges.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="block-size">Matches per virtual group:</Label>
                <Select
                  value={blockSize.toString()}
                  onValueChange={(value) => setBlockSize(parseInt(value))}
                >
                  <SelectTrigger id="block-size" className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Match Count</CardTitle>
              <CardDescription>
                Set qualification match count. API sync is preferred when
                available.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isApiMatchCountAvailable && apiMatchCount !== matchCount && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Update Available:</strong> API shows {apiMatchCount}{" "}
                    matches, current value is{" "}
                    {matchCount > 0 ? matchCount : "unset"}.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-3">
                  <Label htmlFor="manual-match-count">Set Manually</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="manual-match-count"
                      type="number"
                      min="1"
                      max="200"
                      placeholder="e.g. 80"
                      value={manualMatchInput}
                      onChange={(e) => setManualMatchInput(e.target.value)}
                      className="w-24"
                    />
                    <Button
                      variant="outline"
                      onClick={handleSetManualMatchCount}
                      disabled={!manualMatchInput}
                    >
                      Set
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 ml-6">
                  <Label>Sync from API</Label>
                  <Button
                    variant={
                      isApiMatchCountAvailable && apiMatchCount !== matchCount
                        ? "default"
                        : "outline"
                    }
                    onClick={handleSyncMatchCount}
                    disabled={isSyncingMatchCount}
                  >
                    {isSyncingMatchCount ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isSyncingMatchCount ? "Checking..." : "Sync"}
                  </Button>
                </div>
              </div>

              {matchCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                  <span>
                    {matchCount} matches / {blockSize} per group ={" "}
                    <strong>{calculatedBlocks} virtual groups</strong>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generate Virtual Groups</CardTitle>
              <CardDescription>
                Generate groups, then edit match assignments directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerateBlocks}
                disabled={matchCount <= 0 || isGeneratingBlocks}
              >
                {isGeneratingBlocks ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Virtual Groups"
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {blocks.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card className="gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Matches
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{matchCount}</div>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Filled Positions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {scheduleSummary.totalAssigned}
                </div>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Open Positions
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {scheduleSummary.unassigned}
                </div>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Assigned Scouts
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {scheduleSummary.activeAssignedCount}
                </div>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Preferred Pairings
                </CardTitle>
                <Handshake className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {scheduleSummary.preferredPairings}
                </div>
              </CardContent>
            </Card>
          </div>

          <Collapsible defaultOpen={true}>
            <Card>
              <CardHeader>
                <CollapsibleTrigger className="group w-full text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <UserRound className="h-5 w-5" />
                        Active Scouts
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {sortedActiveUsers.length} selected
                      </Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  </div>
                </CollapsibleTrigger>
                <CardDescription>
                  Choose who is available. Auto-fill uses these scouts and keeps existing assignments.
                </CardDescription>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveScouts(sortedUsers.map((user) => user.id))}>Select all scouts</Button>
                    <Button variant="ghost" size="sm" onClick={() => setActiveScouts([])}>Deselect all</Button>
                  </div>
                  {sortedUsers.length === 0 && <p className="text-sm text-muted-foreground">No scouts are available. Add team members before assigning matches.</p>}
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {sortedUsers.map((scout) => (
                      <ActiveScoutCheckbox
                        key={scout.id}
                        scout={scout}
                        isActive={activeScoutSet.has(scout.id)}
                        onToggle={toggleActiveScout}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button
                      onClick={autoAssignAllMatches}
                      disabled={isAutoAssigning || sortedActiveUsers.length === 0 || isSaving}
                    >
                      {isAutoAssigning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        "Auto-Fill All Matches"
                      )}
                    </Button>
                    <Button variant="outline" onClick={clearAssignments}>
                      Clear All Assignments
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Match Assignments
                  </CardTitle>
                  <CardDescription>
                    Find a match or scout, or focus on positions that still need coverage.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-sm px-3 py-1">
                    {blocks.length} virtual groups
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowResetDialog(true)}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Collapsible
                  open={showGroupTemplates}
                  onOpenChange={setShowGroupTemplates}
                >
                  <div className="rounded-md border p-4">
                    <CollapsibleTrigger className="group w-full text-left">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          Assign multiple matches
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {showGroupTemplates && (
                        <div className="mt-4 space-y-3">
                          {blocks.map((block) => (
                            <div key={block.id} className="rounded border p-3">
                              <div className="text-sm font-medium mb-2">
                                {block.name} ({block.matches[0]}-
                                {block.matches[block.matches.length - 1]})
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                {(["red", "blue"] as const).map((alliance) => (
                                  <div
                                    key={`${block.id}-${alliance}`}
                                    className="space-y-2"
                                  >
                                    <div
                                      className={`text-xs font-medium ${alliance === "red" ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
                                    >
                                      {alliance === "red" ? "Red" : "Blue"}{" "}
                                      Template
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      {Array.from(
                                        { length: scoutsPerAlliance },
                                        (_, position) => {
                                          const currentValue =
                                            getGroupSlotValue(
                                              block,
                                              alliance,
                                              position,
                                            );
                                          return (
                                            <div
                                              key={`${block.id}-${alliance}-${position}`}
                                              className="flex min-w-0 items-center gap-2"
                                            >
                                              <Label className="text-xs mr-2">
                                                S{position + 1}
                                              </Label>
                                              <Select
                                                value={
                                                  currentValue === "mixed"
                                                    ? "mixed"
                                                    : (currentValue ?? "none")
                                                }
                                                onValueChange={(value) =>
                                                  applyGroupSlot(
                                                    block,
                                                    alliance,
                                                    position,
                                                    value === "none"
                                                      ? null
                                                      : value,
                                                  )
                                                }
                                              >
                                                <SelectTrigger aria-label={`${block.name}, ${alliance} position ${position + 1}`} className="w-full min-w-0 text-xs">
                                                  <SelectValue placeholder="Apply to group" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">
                                                    Clear Slot
                                                  </SelectItem>
                                                  {currentValue === "mixed" && (
                                                    <SelectItem
                                                      value="mixed"
                                                      disabled
                                                    >
                                                      Mixed Values
                                                    </SelectItem>
                                                  )}
                                                  {sortedActiveUsers.map(
                                                    (user) => (
                                                      <SelectItem
                                                        key={user.id}
                                                        value={user.id}
                                                      >
                                                        {user.name}
                                                      </SelectItem>
                                                    ),
                                                  )}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/40 p-3">
                  <div className="space-y-2">
                    <Label htmlFor="find-match">Match number</Label>
                    <Input id="find-match" type="number" min={1} max={matchCount} placeholder="All matches" value={matchQuery} onChange={(event) => setMatchQuery(event.target.value)} className="w-36" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filter-scout">Assigned scout</Label>
                    <Select value={scoutFilter} onValueChange={setScoutFilter}>
                      <SelectTrigger id="filter-scout" className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All scouts</SelectItem>
                        {sortedUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-h-9 items-center gap-2">
                    <Checkbox id="only-open-slots" checked={onlyOpenSlots} onCheckedChange={(checked) => setOnlyOpenSlots(checked === true)} />
                    <Label htmlFor="only-open-slots">Open slots only</Label>
                  </div>
                  {(matchQuery || scoutFilter !== "all" || onlyOpenSlots) && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
                </div>
                <p className="text-sm text-muted-foreground" role="status">Showing {visibleMatches.length} of {localMatches.length} matches</p>
                {visibleMatches.length === 0 && (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="font-medium">No matches fit these filters</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try another match or scout, or show the full schedule.</p>
                    <Button variant="outline" className="mt-4" onClick={clearFilters}>Show all matches</Button>
                  </div>
                )}
                <div className="space-y-2">
                  {visibleMatches.map((match) => (
                    <MatchAssignmentRow
                      key={match.matchNumber}
                      match={match}
                      scoutsPerAlliance={scoutsPerAlliance}
                      getAvailableUsersForMatchSlot={
                        getAvailableUsersForMatchSlot
                      }
                      setLocalMatchScout={setLocalMatchScout}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Scout Workload Distribution
              </CardTitle>
              <CardDescription>
                Shows how many matches each scout is assigned to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {workloadList.map(({ user, matchesAssigned, isActive }) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant={matchesAssigned > 0 ? "default" : "secondary"}
                    >
                      {matchesAssigned} match{matchesAssigned !== 1 ? "es" : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>


        </>
      )}

        {hasUnsavedChanges && (
          <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-background p-3 shadow-lg">
            <Badge variant="outline" className="text-chart-5 border-chart-5">
              Unsaved Changes
            </Badge>
            <Button
              variant="outline"
              onClick={discardChanges}
              disabled={isSaving}
            >
              Discard
            </Button>
            <Button onClick={saveAllChanges} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        )}

      <DeleteConfirmationDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={handleReset}
        title="Reset Schedule"
        description="This will clear all match assignments for this event. Virtual groups can be regenerated anytime."
        confirmButtonText="Reset"
        loadingText="Resetting..."
        loading={isResetting}
        variant="destructive"
      />
    </div>
  );
}
