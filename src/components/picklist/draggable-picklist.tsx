"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ReactSortable, ItemInterface } from "react-sortablejs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  GripVertical,
  Trash2,
  Save,
} from "lucide-react";
import { CompetitionType, PicklistEntry } from "@/lib/types";
import { usePicklist } from "@/hooks/use-picklist";
import { useEventTeams } from "@/hooks/use-event-teams";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { toast } from "sonner";

interface DraggablePicklistProps {
  eventCode: string;
  year: number;
  competitionType: CompetitionType;
  ownTeamNumber?: number;
}

interface TeamEPAData {
  totalEPA: number;
  autoEPA: number;
  teleopEPA: number;
  endgameEPA: number;
}

/** Shapes of the API responses this component reads. */
interface RankingItemResponse {
  team_key: string;
  rank: number;
}

interface RankingBlockResponse {
  rankings?: RankingItemResponse[];
}

interface PicklistTeamResponse {
  teamNumber: number;
  totalEPA?: number;
  autoEPA?: number;
  teleopEPA?: number;
  endgameEPA?: number;
}

interface PicklistNoteResponse {
  teamNumber: number;
  note?: string | null;
}

interface SortableTeamItem extends ItemInterface {
  id: string;
  teamNumber: number;
  isBlacklisted?: boolean;
}

export function DraggablePicklist({
  eventCode,
  year,
  competitionType,
  ownTeamNumber = 492,
}: DraggablePicklistProps) {
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set());
  const [teamNotes, setTeamNotes] = useState<Record<number, string>>({});
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [qualRankings, setQualRankings] = useState<Map<number, number>>(
    new Map(),
  );
  const [epaData, setEpaData] = useState<Map<number, TeamEPAData>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localPick1Order, setLocalPick1Order] = useState<SortableTeamItem[]>(
    [],
  );
  const [localPick2Order, setLocalPick2Order] = useState<SortableTeamItem[]>(
    [],
  );
  const [localBlacklistOrder, setLocalBlacklistOrder] = useState<
    SortableTeamItem[]
  >([]);
  const [localUnlisted, setLocalUnlisted] = useState<SortableTeamItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const noteSaveTimersRef = useRef<Record<number, NodeJS.Timeout>>({});
  const notesLoadedRef = useRef(false);
  const syncingRef = useRef(false);
  const pick1IdRef = useRef<number | undefined>(undefined);
  const pick2IdRef = useRef<number | undefined>(undefined);
  const blacklistIdRef = useRef<number | undefined>(undefined);
  const localPick1Ref = useRef<SortableTeamItem[]>([]);
  const localPick2Ref = useRef<SortableTeamItem[]>([]);
  const localBlacklistRef = useRef<SortableTeamItem[]>([]);

  // Get all event teams
  const { teams: allEventTeams = [], loading: isEventTeamsLoading } =
    useEventTeams();

  // Initialize picklists
  const pick1 = usePicklist({
    eventCode,
    year,
    competitionType,
    picklistType: "pick1",
  });

  const pick2 = usePicklist({
    eventCode,
    year,
    competitionType,
    picklistType: "pick2",
  });

  const blacklist = usePicklist({
    eventCode,
    year,
    competitionType,
    picklistType: "blacklist",
  });

  // Keep refs in sync for use in debounced autosave (avoids stale closures)
  useEffect(() => {
    pick1IdRef.current = pick1.picklist?.id;
  }, [pick1.picklist?.id]);
  useEffect(() => {
    pick2IdRef.current = pick2.picklist?.id;
  }, [pick2.picklist?.id]);
  useEffect(() => {
    blacklistIdRef.current = blacklist.picklist?.id;
  }, [blacklist.picklist?.id]);
  useEffect(() => {
    localPick1Ref.current = localPick1Order;
  }, [localPick1Order]);
  useEffect(() => {
    localPick2Ref.current = localPick2Order;
  }, [localPick2Order]);
  useEffect(() => {
    localBlacklistRef.current = localBlacklistOrder;
  }, [localBlacklistOrder]);

  // Helper to convert PicklistEntry[] to SortableTeamItem[]
  const toSortableItems = useCallback(
    (entries: PicklistEntry[]): SortableTeamItem[] => {
      return entries.map((e) => ({
        id: String(e.teamNumber),
        teamNumber: e.teamNumber,
      }));
    },
    [],
  );

  // Sync local state with picklist entries (but not during save)
  useEffect(() => {
    if (!isSaving && !syncingRef.current) {
      if (!pick1.picklist && !pick2.picklist) {
        return;
      }

      setLocalPick1Order(toSortableItems(pick1.entries));
      setLocalPick2Order(toSortableItems(pick2.entries));
      setLocalBlacklistOrder(toSortableItems(blacklist.entries));
      setHasUnsavedChanges(false);
    }
  }, [
    pick1.entries,
    pick2.entries,
    blacklist.entries,
    isSaving,
    toSortableItems,
  ]);

  // Compute unlisted teams whenever picks or event teams change
  useEffect(() => {
    const pick1TeamNumbers = new Set(localPick1Order.map((e) => e.teamNumber));
    const pick2TeamNumbers = new Set(localPick2Order.map((e) => e.teamNumber));
    const blacklistTeamNumbers = new Set(
      localBlacklistOrder.map((e) => e.teamNumber),
    );

    const unlisted = allEventTeams
      .filter(
        (team) =>
          team.teamNumber !== ownTeamNumber &&
          !pick1TeamNumbers.has(team.teamNumber) &&
          !pick2TeamNumbers.has(team.teamNumber) &&
          !blacklistTeamNumbers.has(team.teamNumber),
      )
      .map((team) => ({
        id: String(team.teamNumber),
        teamNumber: team.teamNumber,
        qualRanking: qualRankings.get(team.teamNumber) ?? 999,
      }))
      .sort((a, b) => a.qualRanking - b.qualRanking);

    setLocalUnlisted(unlisted);
  }, [
    allEventTeams,
    localPick1Order,
    localPick2Order,
    localBlacklistOrder,
    ownTeamNumber,
    qualRankings,
  ]);

  // Fetch qualification rankings from dedicated TBA endpoint (always returns real qual rankings)
  useEffect(() => {
    const fetchQualRankings = async () => {
      try {
        const params = new URLSearchParams({
          eventCode,
          competitionType,
          year: year.toString(),
        });
        const response = await fetch(
          `/api/events/${encodeURIComponent(eventCode)}/rankings?${params}`,
        );
        if (response.ok) {
          const data: RankingBlockResponse | RankingBlockResponse[] =
            await response.json();
          const qualMap = new Map<number, number>();
          // TBA returns [{ rankings: [{ team_key, rank, ... }] }]
          const rankingBlock = Array.isArray(data) ? data[0] : data;
          const rankingItems = rankingBlock?.rankings || [];
          rankingItems.forEach((item) => {
            const teamNumber = parseInt(
              String(item.team_key).replace(/^frc/i, ""),
              10,
            );
            if (!isNaN(teamNumber)) {
              qualMap.set(teamNumber, item.rank);
            }
          });
          if (qualMap.size > 0) {
            setQualRankings(qualMap);
          }
        }
      } catch (error) {
        console.error("Error fetching qual rankings:", error);
      }
    };
    fetchQualRankings();
  }, [eventCode, year, competitionType]);

  // Fetch EPA data from picklist API (uses local scouting data)
  useEffect(() => {
    const fetchEpaData = async () => {
      try {
        const params = new URLSearchParams({
          eventCode,
          year: year.toString(),
          competitionType,
        });
        const response = await fetch(`/api/scouting/picklist?${params}`);
        if (response.ok) {
          const data: { teams?: PicklistTeamResponse[] } =
            await response.json();
          const epaMap = new Map<number, TeamEPAData>();
          if (data.teams && Array.isArray(data.teams)) {
            data.teams.forEach((team) => {
              epaMap.set(team.teamNumber, {
                totalEPA: team.totalEPA ?? 0,
                autoEPA: team.autoEPA ?? 0,
                teleopEPA: team.teleopEPA ?? 0,
                endgameEPA: team.endgameEPA ?? 0,
              });
            });
          }
          if (epaMap.size > 0) {
            setEpaData(epaMap);
          }
        }
      } catch (error) {
        console.error("Error fetching EPA data:", error);
      }
    };
    fetchEpaData();
  }, [eventCode, year, competitionType]);

  // Load notes from database when picklists are ready
  useEffect(() => {
    if (notesLoadedRef.current) return;
    const picklistId =
      pick1.picklist?.id || pick2.picklist?.id || blacklist.picklist?.id;
    if (!picklistId) return;

    const loadNotes = async () => {
      try {
        const loaded: Record<number, string> = {};
        if (picklistId) {
          const res = await fetch(
            `/api/scouting/picklist/notes?picklistId=${picklistId}`,
          );
          if (res.ok) {
            const data: { notes?: PicklistNoteResponse[] } = await res.json();
            if (data.notes && Array.isArray(data.notes)) {
              data.notes.forEach((n) => {
                const content = n.note || "";
                if (content) loaded[n.teamNumber] = content;
              });
            }
          }
        }
        setTeamNotes((prev) => ({ ...prev, ...loaded }));
        notesLoadedRef.current = true;
      } catch (error) {
        console.error("Error loading notes:", error);
      }
    };
    loadNotes();
  }, [pick1.picklist?.id, pick2.picklist?.id, blacklist.picklist?.id]);

  // Compute EPA min/max for gradient scaling
  const epaRange = useMemo(() => {
    const allValues = Array.from(epaData.values()).map((e) => e.totalEPA);
    if (allValues.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...allValues), max: Math.max(...allValues) };
  }, [epaData]);

  const getEpaColor = useCallback(
    (value: number) => {
      const { min, max } = epaRange;
      if (max === min) return "hsl(60, 70%, 45%)";
      const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
      const hue = Math.round(t * 120);
      return `hsl(${hue}, 75%, 40%)`;
    },
    [epaRange],
  );

  const getEpaBgColor = useCallback(
    (value: number) => {
      const { min, max } = epaRange;
      if (max === min) return "hsla(60, 70%, 45%, 0.12)";
      const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
      const hue = Math.round(t * 120);
      return `hsla(${hue}, 75%, 45%, 0.12)`;
    },
    [epaRange],
  );

  // Initialize picklists if needed
  const initializePicklists = useCallback(async () => {
    try {
      const initTasks: Promise<unknown>[] = [];
      if (!pick1.picklist) initTasks.push(pick1.createPicklist([]));
      if (!pick2.picklist) initTasks.push(pick2.createPicklist([]));
      if (!blacklist.picklist) initTasks.push(blacklist.createPicklist([]));

      if (initTasks.length === 0) return;
      await Promise.all(initTasks);
      toast.success("Picklists initialized - drag teams from Unlisted");
    } catch (error) {
      console.error("Failed to initialize picklists:", error);
      toast.error("Failed to initialize picklists");
    }
  }, [pick1, pick2, blacklist]);

  // Calculate total unique teams in picklists
  const totalPicklistTeams = useMemo(() => {
    const allPicklistTeams = new Set<number>();
    localPick1Order.forEach((e) => allPicklistTeams.add(e.teamNumber));
    localPick2Order.forEach((e) => allPicklistTeams.add(e.teamNumber));
    return allPicklistTeams.size;
  }, [localPick1Order, localPick2Order]);

  const totalEventTeams = allEventTeams.filter(
    (t) => t.teamNumber !== ownTeamNumber,
  ).length;

  const teamNameByNumber = useMemo(() => {
    return new Map(
      allEventTeams.map((team) => [team.teamNumber, team.nickname]),
    );
  }, [allEventTeams]);

  const totalTrackedTeams = useMemo(() => {
    const trackedTeams = new Set<number>();
    localPick1Order.forEach((e) => trackedTeams.add(e.teamNumber));
    localPick2Order.forEach((e) => trackedTeams.add(e.teamNumber));
    localBlacklistOrder.forEach((e) => trackedTeams.add(e.teamNumber));
    localUnlisted.forEach((e) => trackedTeams.add(e.teamNumber));
    return trackedTeams.size;
  }, [localPick1Order, localPick2Order, localBlacklistOrder, localUnlisted]);

  // Resolve which picklistId a team belongs to (pick1, pick2, or fallback)
  const resolvePicklistId = useCallback(
    (teamNumber: number): number | undefined => {
      if (localPick1Ref.current.some((e) => e.teamNumber === teamNumber)) {
        return pick1IdRef.current;
      }
      if (localPick2Ref.current.some((e) => e.teamNumber === teamNumber)) {
        return pick2IdRef.current;
      }
      if (localBlacklistRef.current.some((e) => e.teamNumber === teamNumber)) {
        return blacklistIdRef.current;
      }
      // Unlisted teams: use whichever picklist exists
      return pick1IdRef.current ?? pick2IdRef.current;
    },
    [],
  );

  // Auto-save note to database with debounce
  // Uses refs so the debounced timer always reads the latest values
  const handleNoteChange = useCallback(
    (teamNumber: number, value: string) => {
      setTeamNotes((prev) => ({ ...prev, [teamNumber]: value }));

      // Clear any pending save for this team
      if (noteSaveTimersRef.current[teamNumber]) {
        clearTimeout(noteSaveTimersRef.current[teamNumber]);
      }

      noteSaveTimersRef.current[teamNumber] = setTimeout(async () => {
        // Resolve picklistId at fire time from refs (always fresh)
        const picklistId = resolvePicklistId(teamNumber);
        if (!picklistId) {
          console.warn(
            "Cannot save note: no picklist ID available for team",
            teamNumber,
          );
          return;
        }

        try {
          if (value.trim()) {
            const res = await fetch("/api/scouting/picklist/notes", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ picklistId, teamNumber, note: value }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.error("Failed to save note:", res.status, errData);
              toast.error("Failed to save note");
            }
          } else {
            const res = await fetch(
              `/api/scouting/picklist/notes?picklistId=${picklistId}&teamNumber=${teamNumber}`,
              { method: "DELETE" },
            );
            if (!res.ok) {
              console.error("Failed to delete note:", res.status);
            }
          }
        } catch (error) {
          console.error("Error saving note:", error);
          toast.error("Failed to save note");
        }
      }, 800);
    },
    [resolvePicklistId],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const pick1Data = localPick1Order.map((e, idx) => ({
        teamNumber: e.teamNumber,
        rank: idx + 1,
      }));
      const pick2Data = localPick2Order.map((e, idx) => ({
        teamNumber: e.teamNumber,
        rank: idx + 1,
      }));
      const blacklistData = localBlacklistOrder.map((e, idx) => ({
        teamNumber: e.teamNumber,
        rank: idx + 1,
      }));

      await Promise.all([
        pick1.updatePicklistOrder(pick1Data),
        pick2.updatePicklistOrder(pick2Data),
        blacklist.updatePicklistOrder(blacklistData),
      ]);

      await Promise.all([
        pick1.fetchExistingPicklist(),
        pick2.fetchExistingPicklist(),
        blacklist.fetchExistingPicklist(),
      ]);

      setHasUnsavedChanges(false);
      toast.success("Picklist saved successfully");
    } catch (error) {
      console.error("Failed to save picklist:", error);
      toast.error("Failed to save picklist");
    } finally {
      setIsSaving(false);
    }
  }, [
    localPick1Order,
    localPick2Order,
    localBlacklistOrder,
    pick1,
    pick2,
    blacklist,
  ]);

  const confirmReset = useCallback(async () => {
    try {
      await pick1.deletePicklist();
      await pick2.deletePicklist();
      await blacklist.deletePicklist();
      setLocalPick1Order([]);
      setLocalPick2Order([]);
      setLocalBlacklistOrder([]);
      setHasUnsavedChanges(false);
      notesLoadedRef.current = false;
      setShowResetDialog(false);
      toast.success("Picklists reset - click Initialize to start fresh");
    } catch (error) {
      console.error("Failed to reset picklists:", error);
      setShowResetDialog(false);
    }
  }, [pick1, pick2, blacklist]);

  const toggleTeamExpanded = (teamNumber: number) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamNumber)) next.delete(teamNumber);
      else next.add(teamNumber);
      return next;
    });
  };

  // ── SortableJS handlers ──
  const handlePick1Change = useCallback((newState: SortableTeamItem[]) => {
    syncingRef.current = true;
    setLocalPick1Order(newState);
    setHasUnsavedChanges(true);
    setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, []);

  const handlePick2Change = useCallback((newState: SortableTeamItem[]) => {
    syncingRef.current = true;
    setLocalPick2Order(newState);
    setHasUnsavedChanges(true);
    setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, []);

  const handleUnlistedChange = useCallback((newState: SortableTeamItem[]) => {
    syncingRef.current = true;
    setLocalUnlisted(newState);
    setHasUnsavedChanges(true);
    setTimeout(() => {
      syncingRef.current = false;
    }, 0);
  }, []);

  type PickListType = "1stPick" | "2ndPick" | "Unlisted";

  const moveTeam = useCallback(
    (teamNumber: number, from: PickListType, to: PickListType) => {
      const remove = (list: SortableTeamItem[]) =>
        list.filter((t) => t.teamNumber !== teamNumber);

      const team: SortableTeamItem = { id: String(teamNumber), teamNumber };

      if (from === "1stPick") setLocalPick1Order((l) => remove(l));
      if (from === "2ndPick") setLocalPick2Order((l) => remove(l));
      if (from === "Unlisted") setLocalUnlisted((l) => remove(l));

      if (to === "1stPick") setLocalPick1Order((l) => [...l, team]);
      if (to === "2ndPick") setLocalPick2Order((l) => [...l, team]);
      if (to === "Unlisted") setLocalUnlisted((l) => [...l, team]);

      setHasUnsavedChanges(true);
    },
    [],
  );

  //helper method to remove a team from all lists
  const removeTeamFromAllLists = (teamNumber: number) => {
    setLocalPick1Order((prev) =>
      prev.filter((t) => t.teamNumber !== teamNumber),
    );
    setLocalPick2Order((prev) =>
      prev.filter((t) => t.teamNumber !== teamNumber),
    );
    setLocalUnlisted((prev) => prev.filter((t) => t.teamNumber !== teamNumber));
    setLocalBlacklistOrder((prev) =>
      prev.filter((t) => t.teamNumber !== teamNumber),
    );
  };

  // ── Team card renderer ──
  const renderTeamCard = (
    teamNumber: number,
    rank: number | null,
    listType: PickListType,
    blacklisted: boolean,
  ) => {
    const isExpanded = expandedTeams.has(teamNumber);
    const qualRank = qualRankings.get(teamNumber);
    const epa = epaData.get(teamNumber);
    const teamName = teamNameByNumber.get(teamNumber) || `Team ${teamNumber}`;

    return (
      <div key={teamNumber} data-id={String(teamNumber)}>
        <Collapsible
          open={isExpanded}
          onOpenChange={() => toggleTeamExpanded(teamNumber)}
        >
          <div
            className={`border rounded-lg transition-all ${blacklisted && "bg-muted"}`}
          >
            <div className="flex items-center gap-1 p-3 w-full">
              <div className="sortable-handle cursor-grab active:cursor-grabbing hover:bg-accent rounded p-1 flex-shrink-0">
                <GripVertical className="h-4 w-4" />
              </div>
              {rank !== null && (
                <div className="flex-shrink-0 font-bold text-lg w-6">
                  #{rank}
                </div>
              )}
              <div className="flex-grow font-semibold text-lg text-left">
                {teamNumber}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {blacklisted && (
                  <div className="px-2 py-0.5 rounded-md text-xs font-bold bg-gray">
                    Blacklisted
                  </div>
                )}
                {epa && (
                  <div
                    className="px-2 py-0.5 rounded-md text-xs font-bold"
                    style={{
                      color: getEpaColor(epa.totalEPA),
                      backgroundColor: getEpaBgColor(epa.totalEPA),
                    }}
                    title={`Auto: ${epa.autoEPA.toFixed(1)} | Teleop: ${epa.teleopEPA.toFixed(1)} | Endgame: ${epa.endgameEPA.toFixed(1)}`}
                  >
                    EPA {epa.totalEPA.toFixed(1)}
                  </div>
                )}
                {qualRank !== undefined && !blacklisted && (
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 text-xs min-[60rem]:hidden min-[76rem]:block"
                  >
                    R{qualRank}
                  </Badge>
                )}
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 flex-grow min-w-0 cursor-pointer">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent>
              <div className="px-3 pb-3 space-y-3 border-t pt-3 bg-background">
                <div>
                  <div className="text-xs text-muted-foreground">Team Name</div>
                  <div className="font-semibold">{teamName}</div>
                </div>
                {epa && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md border p-2">
                      <div className="text-xs text-muted-foreground">Auto</div>
                      <div
                        className="text-sm font-bold"
                        style={{ color: getEpaColor(epa.autoEPA) }}
                      >
                        {epa.autoEPA.toFixed(1)}
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-xs text-muted-foreground">
                        Teleop
                      </div>
                      <div
                        className="text-sm font-bold"
                        style={{ color: getEpaColor(epa.teleopEPA) }}
                      >
                        {epa.teleopEPA.toFixed(1)}
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-xs text-muted-foreground">
                        Endgame
                      </div>
                      <div
                        className="text-sm font-bold"
                        style={{ color: getEpaColor(epa.endgameEPA) }}
                      >
                        {epa.endgameEPA.toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium mb-1">Notes:</div>
                  <Textarea
                    value={teamNotes[teamNumber] || ""}
                    onChange={(e) =>
                      handleNoteChange(teamNumber, e.target.value)
                    }
                    placeholder="Add notes about this team..."
                    className="min-h-20"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Auto-saves after you stop typing
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-start mt-4 gap-2 flex-row min-[56rem]:flex-col min-[76rem]:flex-row">
                      {listType !== "1stPick" && (
                        <Button
                          variant="default"
                          onClick={() =>
                            moveTeam(teamNumber, listType, "1stPick")
                          }
                        >
                          Set 1st Pick
                        </Button>
                      )}
                      {listType !== "2ndPick" && (
                        <Button
                          variant="default"
                          onClick={() =>
                            moveTeam(teamNumber, listType, "2ndPick")
                          }
                        >
                          Set 2nd Pick
                        </Button>
                      )}
                      {listType !== "Unlisted" && (
                        <Button
                          variant="default"
                          onClick={() =>
                            moveTeam(teamNumber, listType, "Unlisted")
                          }
                        >
                          Set Unlisted
                        </Button>
                      )}
                    </div>
                    <div className="">
                      {!blacklisted && (
                        <Button
                          variant="destructive"
                          onClick={() => {
                            removeTeamFromAllLists(teamNumber);
                            setLocalBlacklistOrder((prev) => [
                              ...prev,
                              {
                                id: String(teamNumber),
                                teamNumber,
                                isBlacklisted: true,
                              },
                            ]);
                            setHasUnsavedChanges(true);
                          }}
                        >
                          Blacklist
                        </Button>
                      )}
                      {blacklisted && (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            removeTeamFromAllLists(teamNumber);
                            setLocalUnlisted((prev) => [
                              ...prev,
                              {
                                id: String(teamNumber),
                                teamNumber,
                                isBlacklisted: false,
                              },
                            ]);
                            setHasUnsavedChanges(true);
                          }}
                        >
                          Whitelist
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>
    );
  };

  // ── Loading state ──
  if (pick1.isLoading || pick2.isLoading || blacklist.isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading picklists...
          </div>
        </CardContent>
      </Card>
    );
  }

  const showInitialize =
    !pick1.picklist && !pick2.picklist && !blacklist.picklist;

  const sortableGroupOptions = {
    name: "picklist",
    pull: true as const,
    put: true as const,
  };

  const combinedUnlisted: SortableTeamItem[] = [
    ...localUnlisted.map((item) => ({ ...item, isBlacklisted: false })),
    ...localBlacklistOrder.map((item) => ({ ...item, isBlacklisted: true })),
  ];

  // ── Render ──
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {competitionType === "FRC" ? "FRC" : "FTC"} Picklist - {eventCode}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalTrackedTeams} / {totalEventTeams} teams (excluding #
            {ownTeamNumber})
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 mt-4 sm:mt-0">
            {showInitialize ? (
              <Button onClick={initializePicklists}>
                <Plus className="mr-2 h-4 w-4" />
                Initialize Picklist
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || isSaving}
                  variant="default"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowResetDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Reset Picklist
                </Button>
              </>
            )}
          </div>
          <div>
            {!showInitialize && hasUnsavedChanges && (
              <div className="flex justify-end text-center text-sm text-red-600 dark:text-amber-500 font-medium">
                ⚠ You have unsaved changes
              </div>
            )}
          </div>
        </div>
      </div>

      {!showInitialize && (
        <div
          className={`grid gap-6 ${competitionType === "FRC" ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2"}`}
        >
          {/* Pick 1 List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between -mb-8">
                <CardTitle>1st Pick</CardTitle>
                <Badge variant="outline">{localPick1Order.length} teams</Badge>
              </div>
            </CardHeader>
            <CardContent className="sm:min-h-96 space-y-2 p-4">
              <ReactSortable
                list={localPick1Order}
                setList={handlePick1Change}
                group={sortableGroupOptions}
                animation={200}
                handle=".sortable-handle"
                filter="textarea,button,input"
                preventOnFilter={false}
                ghostClass="opacity-30"
                dragClass="shadow-lg"
                scroll={true}
                scrollSpeed={20}
                scrollSensitivity={100}
                className="space-y-2 sm:min-h-48"
              >
                {localPick1Order.map((item, idx) =>
                  renderTeamCard(item.teamNumber, idx + 1, "1stPick", false),
                )}
              </ReactSortable>
              {localPick1Order.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Drag teams here
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pick 2 List (FRC only) */}
          {competitionType === "FRC" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between -mb-8">
                  <CardTitle>2nd Pick</CardTitle>
                  <Badge variant="outline">
                    {localPick2Order.length} teams
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="sm:min-h-96 space-y-2 p-4">
                <ReactSortable
                  list={localPick2Order}
                  setList={handlePick2Change}
                  group={sortableGroupOptions}
                  animation={200}
                  handle=".sortable-handle"
                  filter="textarea,button,input"
                  preventOnFilter={false}
                  ghostClass="opacity-30"
                  dragClass="shadow-lg"
                  scroll={true}
                  scrollSpeed={20}
                  scrollSensitivity={100}
                  className="space-y-2 sm:min-h-48"
                >
                  {localPick2Order.map((item, idx) =>
                    renderTeamCard(item.teamNumber, idx + 1, "2ndPick", false),
                  )}
                </ReactSortable>
                {localPick2Order.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    Drag teams here
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unlisted Teams */}
          {combinedUnlisted.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No teams available (check event teams or filters)
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between -mb-8">
                <CardTitle>Unlisted</CardTitle>
                <Badge variant="outline">{localUnlisted.length} teams</Badge>
              </div>
            </CardHeader>
            <CardContent className="sm:min-h-96 space-y-2 p-4">
              <ReactSortable
                list={combinedUnlisted}
                setList={(newState) => {
                  syncingRef.current = true;

                  // Split back out after drag
                  const newUnlisted: SortableTeamItem[] = [];
                  const newBlacklist: SortableTeamItem[] = [];

                  const seen = new Set<number>();

                  newState.forEach((item) => {
                    if (seen.has(item.teamNumber)) return;
                    seen.add(item.teamNumber);

                    if (item.isBlacklisted) newBlacklist.push(item);
                    else newUnlisted.push(item);
                  });

                  setLocalUnlisted(newUnlisted);
                  setLocalBlacklistOrder(newBlacklist);

                  setHasUnsavedChanges(true);
                  setTimeout(() => {
                    syncingRef.current = false;
                  }, 0);
                }}
                group={sortableGroupOptions}
                animation={200}
                handle=".sortable-handle"
                filter="textarea,button,input"
                preventOnFilter={false}
                ghostClass="opacity-30"
                dragClass="shadow-lg"
                scroll={true}
                scrollSpeed={20}
                scrollSensitivity={100}
                className="space-y-2 min-h-48"
              >
                {combinedUnlisted.map((item) =>
                  renderTeamCard(
                    item.teamNumber,
                    null,
                    "Unlisted",
                    item.isBlacklisted ?? false,
                  ),
                )}
              </ReactSortable>
              {localUnlisted.length === 0 && isEventTeamsLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  Loading event teams...
                </div>
              )}
              {localUnlisted.length === 0 && !isEventTeamsLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  All teams assigned
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <DeleteConfirmationDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        onConfirm={confirmReset}
        title="Reset Picklist"
        description="Are you sure you want to reset the picklist? This will delete all current picks and start fresh."
        confirmButtonText="Reset"
        loadingText="Resetting..."
      />
    </div>
  );
}
