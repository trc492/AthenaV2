"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Picklist,
  PicklistEntry,
  PicklistNote,
  CompetitionType,
} from "@/lib/types";

interface UsePicklistOptions {
  eventCode: string;
  year: number;
  competitionType: CompetitionType;
  picklistType?: "pick1" | "pick2" | "blacklist" | "main";
}

interface TeamPicklistData {
  teamNumber: number;
  driveTrain: string;
  weight?: number;
  length?: number;
  width?: number;
  matchesPlayed: number;
  totalEPA: number;
  autoEPA: number;
  teleopEPA: number;
  endgameEPA: number;
  rank: number;
}

export function usePicklist(options: UsePicklistOptions) {
  const [picklist, setPicklist] = useState<Picklist | null>(null);
  const currentPicklistId = picklist?.id;
  const [entries, setEntries] = useState<PicklistEntry[]>([]);
  const [notes, setNotes] = useState<Map<number, PicklistNote[]>>(new Map());
  // The initial load is complete once the loaded key matches the options.
  const loadKey = `${options.eventCode}|${options.year}|${options.competitionType}|${options.picklistType ?? "main"}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const isLoading = loadedKey !== loadKey;
  const { eventCode, year, competitionType, picklistType } = options;
  const loadOptions = useMemo(
    () => ({ eventCode, year, competitionType, picklistType }),
    [eventCode, year, competitionType, picklistType],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [initialRanking, setInitialRanking] = useState<TeamPicklistData[]>([]);

  // Fetch initial rankings from TBA/calculated EPA data
  const fetchInitialRanking = useCallback(async () => {
    const teams = await loadInitialRanking(loadOptions);
    if (teams) setInitialRanking(teams);
  }, [loadOptions]);

  // Fetch existing picklist if available
  const fetchExistingPicklist = useCallback(async () => {
    const existing = await loadExistingPicklist(loadOptions);
    if (existing) {
      setPicklist(existing.picklist);
      setEntries(existing.entries);
    }
  }, [loadOptions]);

  // Create a new picklist
  const createPicklist = useCallback(
    async (
      picklistEntries: Omit<
        PicklistEntry,
        "id" | "created_at" | "updated_at"
      >[],
    ) => {
      try {
        setIsSaving(true);
        const response = await fetch("/api/scouting/picklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventCode: options.eventCode,
            year: options.year,
            competitionType: options.competitionType,
            picklistType: options.picklistType || "main",
            entries: picklistEntries,
          }),
        });

        if (!response.ok) throw new Error("Failed to create picklist");

        const data = await response.json();
        setPicklist({
          id: data.id,
          eventCode: options.eventCode,
          year: options.year,
          competitionType: options.competitionType,
          picklistType: options.picklistType || "main",
        });
        setEntries(picklistEntries as PicklistEntry[]);
        return data.id;
      } catch (error) {
        console.error("Error creating picklist:", error);
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [
      options.eventCode,
      options.year,
      options.competitionType,
      options.picklistType,
    ],
  );

  // Update picklist entry order
  const updatePicklistOrder = useCallback(
    async (newEntries: Array<{ teamNumber: number; rank: number }>) => {
      try {
        setIsSaving(true);

        // If this specific picklist doesn't exist yet (common for blacklist), create it on demand.
        let picklistId = currentPicklistId;
        if (!picklistId) {
          picklistId = await createPicklist([]);
        }

        if (!picklistId) {
          throw new Error("Failed to resolve picklist ID for save");
        }

        const response = await fetch("/api/scouting/picklist", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            picklistId,
            entries: newEntries,
          }),
        });

        if (!response.ok) throw new Error("Failed to update picklist order");

        // Rebuild the entries array to trigger React update
        const updatedEntries: PicklistEntry[] = newEntries.map((newEntry) => {
          const existingEntry = entries.find(
            (e) => e.teamNumber === newEntry.teamNumber,
          );
          return {
            id: existingEntry?.id || 0,
            picklistId,
            teamNumber: newEntry.teamNumber,
            rank: newEntry.rank,
            created_at: existingEntry?.created_at
              ? typeof existingEntry.created_at === "string"
                ? new Date(existingEntry.created_at)
                : existingEntry.created_at
              : new Date(),
            updated_at: new Date(),
          };
        });
        setEntries(updatedEntries.sort((a, b) => a.rank - b.rank));
      } catch (error) {
        console.error("Error updating picklist order:", error);
        toast.error("Failed to update picklist order");
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [currentPicklistId, entries, createPicklist],
  );

  // Add a note for a team
  const addNote = useCallback(
    async (teamNumber: number, note: string) => {
      if (!currentPicklistId) {
        toast.error("No picklist selected");
        return;
      }

      try {
        const response = await fetch("/api/scouting/picklist/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            picklistId: currentPicklistId,
            teamNumber,
            note,
          }),
        });

        if (!response.ok) throw new Error("Failed to add note");

        const data = await response.json();
        const teamNotes = notes.get(teamNumber) || [];
        teamNotes.push(data);
        setNotes(new Map(notes).set(teamNumber, teamNotes));
        toast.success("Note added");
      } catch (error) {
        console.error("Error adding note:", error);
        toast.error("Failed to add note");
        throw error;
      }
    },
    [currentPicklistId, notes],
  );

  // Get notes for a team
  const getTeamNotes = useCallback(
    async (teamNumber: number) => {
      if (!currentPicklistId) return [];

      try {
        const params = new URLSearchParams({
          picklistId: currentPicklistId.toString(),
          teamNumber: teamNumber.toString(),
        });

        const response = await fetch(`/api/scouting/picklist/notes?${params}`);
        if (!response.ok) throw new Error("Failed to fetch notes");

        const data = await response.json();
        setNotes(new Map(notes).set(teamNumber, data.notes));
        return data.notes;
      } catch (error) {
        console.error("Error fetching team notes:", error);
        return [];
      }
    },
    [currentPicklistId, notes],
  );

  // Update a note
  const updateNote = useCallback(
    async (noteId: number, teamNumber: number, newText: string) => {
      try {
        const response = await fetch("/api/scouting/picklist/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noteId,
            note: newText,
          }),
        });

        if (!response.ok) throw new Error("Failed to update note");

        const teamNotes = notes.get(teamNumber) || [];
        const updatedNotes = teamNotes.map((n) =>
          n.id === noteId ? { ...n, note: newText } : n,
        );
        setNotes(new Map(notes).set(teamNumber, updatedNotes));
        toast.success("Note updated");
      } catch (error) {
        console.error("Error updating note:", error);
        toast.error("Failed to update note");
        throw error;
      }
    },
    [notes],
  );

  // Delete a note
  const deleteNote = useCallback(
    async (noteId: number, teamNumber: number) => {
      try {
        const response = await fetch(
          `/api/scouting/picklist/notes?noteId=${noteId}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) throw new Error("Failed to delete note");

        const teamNotes = notes.get(teamNumber) || [];
        const updatedNotes = teamNotes.filter((n) => n.id !== noteId);
        setNotes(new Map(notes).set(teamNumber, updatedNotes));
        toast.success("Note deleted");
      } catch (error) {
        console.error("Error deleting note:", error);
        toast.error("Failed to delete note");
        throw error;
      }
    },
    [notes],
  );

  // Delete picklist
  const deletePicklist = useCallback(async () => {
    if (!currentPicklistId) {
      toast.error("No picklist to delete");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(
        `/api/scouting/picklist?picklistId=${currentPicklistId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) throw new Error("Failed to delete picklist");

      setPicklist(null);
      setEntries([]);
      setNotes(new Map());
    } catch (error) {
      console.error("Error deleting picklist:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [currentPicklistId]);

  // Load rankings and any saved picklist whenever the options change
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadInitialRanking(loadOptions),
      loadExistingPicklist(loadOptions),
    ]).then(([teams, existing]) => {
      if (cancelled) return;
      if (teams) setInitialRanking(teams);
      if (existing) {
        setPicklist(existing.picklist);
        setEntries(existing.entries);
      }
      setLoadedKey(loadKey);
    });
    return () => {
      cancelled = true;
    };
  }, [loadOptions, loadKey]);

  return {
    // State
    picklist,
    entries,
    notes: (teamNumber: number) => notes.get(teamNumber) || [],
    isLoading,
    isSaving,
    initialRanking,

    // Actions
    createPicklist,
    updatePicklistOrder,
    addNote,
    getTeamNotes,
    updateNote,
    deleteNote,
    deletePicklist,
    fetchInitialRanking,
    fetchExistingPicklist,
  };
}

/** Returns the ranked teams, or null (after notifying the user) on failure. */
async function loadInitialRanking(
  options: UsePicklistOptions,
): Promise<TeamPicklistData[] | null> {
  try {
    const params = new URLSearchParams({
      eventCode: options.eventCode,
      year: options.year.toString(),
      competitionType: options.competitionType,
    });

    const response = await fetch(`/api/scouting/picklist?${params}`);
    if (!response.ok) throw new Error("Failed to fetch initial ranking");

    const data = await response.json();
    return data.teams;
  } catch (error) {
    console.error("Error fetching initial ranking:", error);
    toast.error("Failed to load ranking data");
    return null;
  }
}

/** Returns the saved picklist and its entries, or null on failure. */
async function loadExistingPicklist(
  options: UsePicklistOptions,
): Promise<{ picklist: Picklist | null; entries: PicklistEntry[] } | null> {
  try {
    const params = new URLSearchParams({
      eventCode: options.eventCode,
      year: options.year.toString(),
      competitionType: options.competitionType,
      picklistType: options.picklistType || "main",
      existingOnly: "true",
    });

    // First get the picklist metadata
    const picklistResponse = await fetch(`/api/scouting/picklist?${params}`);
    if (!picklistResponse.ok) {
      throw new Error(`Failed to fetch picklist: ${picklistResponse.status}`);
    }

    const picklistData = await picklistResponse.json();
    if (!picklistData.picklist) {
      return { picklist: null, entries: [] };
    }

    // Route already returns entries with existing picklist; use them directly
    // to avoid a second request race/failure that can intermittently clear UI.
    if (Array.isArray(picklistData.entries)) {
      return { picklist: picklistData.picklist, entries: picklistData.entries };
    }

    // Fallback for older/alternate response shapes.
    const entriesParams = new URLSearchParams({
      picklistId: picklistData.picklist.id.toString(),
    });
    const entriesResponse = await fetch(
      `/api/scouting/picklist/entries?${entriesParams}`,
    );
    if (!entriesResponse.ok) {
      return { picklist: picklistData.picklist, entries: [] };
    }
    const entriesData = await entriesResponse.json();
    return {
      picklist: picklistData.picklist,
      entries: Array.isArray(entriesData.entries) ? entriesData.entries : [],
    };
  } catch (error) {
    console.error("Error fetching existing picklist:", error);
    return null;
  }
}
