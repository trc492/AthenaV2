"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameConfig, useCurrentGameConfig } from "@/hooks/use-game-config";
import { useSelectedEvent } from "@/hooks/use-event-config";
import { useEventTeamNumbers, useEventTeams } from "@/hooks/use-event-teams";
import { useMatchScheduleTeams } from "@/hooks/use-match-schedule-teams";
import { useScoutingAssignment } from "@/hooks/use-scouting-assignment";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { matchApi } from "@/lib/api/database-client";
import { ScoutSelector } from "@/components/scout-selector";
import { MatchInfoSection } from "@/components/forms/match-info-section";
import { ScoringSection } from "@/components/forms/scoring-section";
import { FormSubmitButtons } from "@/components/forms/form-submit-buttons";
import {
  defaultData,
  hideSpinnersStyle,
  initializeFormData,
  getLastSubmittedMatch,
  setLastSubmittedMatch,
} from "@/components/forms/match-form-utils";
import type { MatchEntry } from "@/lib/types";
import type { DynamicMatchData } from "@/lib/types";
export function DynamicMatchScoutForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
  const gameConfig = useCurrentGameConfig();
  const { competitionType, currentYear } = useGameConfig();
  const selectedEvent = useSelectedEvent();
  const eventTeamNumbers = useEventTeamNumbers();
  const { loading: teamsLoading } = useEventTeams();
  const {
    isLoading: scheduleLoading,
    hasScheduleData,
    getTeamForPosition,
  } = useMatchScheduleTeams();
  const {
    isLoading: assignmentLoading,
    hasAssignments,
    recommendedStartMatch,
    recommendedAlliance,
    recommendedPosition,
    getAssignmentForMatch,
    getNextAssignment,
  } = useScoutingAssignment();
  const [formData, setFormData] = useState<DynamicMatchData>(() =>
    gameConfig ? initializeFormData(gameConfig) : defaultData,
  );
  const [hasAppliedInitialAssignment, setHasAppliedInitialAssignment] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [lastSavedEntry, setLastSavedEntry] = useState<{
    matchNumber: number;
    teamNumber: number;
    nextMatchNumber: number;
    queued: boolean;
  } | null>(null);

  // Tabs state for swipeable interface
  const [activeTab, setActiveTab] = useState("auto");
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const submitInFlightRef = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null,
  );
  const contentRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { id: "auto", label: "Auto", icon: <Zap className="h-4 w-4" /> },
    { id: "teleop", label: "Teleop", icon: <Award className="h-4 w-4" /> },
    {
      id: "endgame",
      label: "Endgame",
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  ];

  // Fetch entry for editing
  useEffect(() => {
    let isMounted = true;

    const fetchEntryForEdit = async () => {
      if (!editId || !gameConfig) return;

      setIsLoadingEdit(true);
      try {
        const response = await fetch(`/api/scouting/entries/match?id=${editId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch entry for editing");
        }

        const entry: MatchEntry = await response.json();

        if (!isMounted) return;

        // Populate form with existing data
        const populatedData: DynamicMatchData = {
          matchNumber: entry.matchNumber,
          teamNumber: entry.teamNumber,
          alliance: entry.alliance,
          alliancePosition: entry.alliancePosition,
          autonomous:
            (entry.gameSpecificData?.autonomous as Record<
              string,
              number | string | boolean
            >) || {},
          teleop:
            (entry.gameSpecificData?.teleop as Record<
              string,
              number | string | boolean
            >) || {},
          endgame:
            (entry.gameSpecificData?.endgame as Record<
              string,
              number | string | boolean
            >) || {},
          fouls:
            (entry.gameSpecificData?.fouls as Record<
              string,
              number | string | boolean
            >) || {},
          notes: entry.notes || "",
        };

        setFormData(populatedData);
        setIsEditMode(true);
        setEditingEntryId(entry.id ?? null);

        toast.info("Editing entry", {
          description: `Match ${entry.matchNumber} - Team ${entry.teamNumber}`,
        });
      } catch (error) {
        if (!isMounted) return;
        console.error("Error fetching entry for edit:", error);
        toast.error("Failed to load entry for editing");
      } finally {
        if (isMounted) {
          setIsLoadingEdit(false);
        }
      }
    };

    fetchEntryForEdit();

    return () => {
      isMounted = false;
    };
  }, [editId, gameConfig]);

  // Reinitialize form data when game config changes (but not in edit mode)
  useEffect(() => {
    if (gameConfig && !isEditMode) {
      setFormData(initializeFormData(gameConfig));
    }
  }, [gameConfig, isEditMode]);

  // Apply initial scouting assignment on first load, using persistent last-submitted match
  useEffect(() => {
    // Skip if already applied, in edit mode, or assignment data not yet loaded
    if (hasAppliedInitialAssignment || isEditMode || assignmentLoading) return;

    // Only apply if we have scouting assignments
    if (!hasAssignments) return;

    const eventCode = selectedEvent?.eventCode;
    const lastSubmitted = eventCode ? getLastSubmittedMatch(eventCode) : 0;

    if (lastSubmitted > 0) {
      // We have a previously submitted match – jump to the next scheduled assignment
      const nextAssignment = getNextAssignment(lastSubmitted);
      const nextMatch = lastSubmitted + 1;

      if (nextAssignment) {
        const resolvedMatch = nextAssignment.matchNumber;

        setFormData((prev) => ({
          ...prev,
          matchNumber: resolvedMatch,
          alliance: nextAssignment.alliance,
          alliancePosition: nextAssignment.position,
        }));
      } else {
        // No upcoming scheduled assignment – just bump the number
        setFormData((prev) => ({
          ...prev,
          matchNumber: nextMatch,
        }));
      }
    } else {
      // No history – fall back to the first assignment (original behaviour)
      setFormData((prev) => ({
        ...prev,
        matchNumber: recommendedStartMatch || prev.matchNumber,
        alliance: recommendedAlliance || prev.alliance,
        alliancePosition: recommendedPosition || prev.alliancePosition,
      }));
    }

    setHasAppliedInitialAssignment(true);
  }, [
    hasAssignments,
    recommendedStartMatch,
    recommendedAlliance,
    recommendedPosition,
    assignmentLoading,
    isEditMode,
    hasAppliedInitialAssignment,
    selectedEvent?.eventCode,
    getNextAssignment,
  ]);

  // Determine if current values match the scouting schedule assignment
  const isMatchFromScoutingSchedule =
    hasAppliedInitialAssignment &&
    hasAssignments &&
    recommendedStartMatch !== null &&
    Number(formData.matchNumber) === recommendedStartMatch;

  const isAllianceFromScoutingSchedule =
    hasAppliedInitialAssignment &&
    hasAssignments &&
    recommendedAlliance !== null &&
    recommendedPosition !== null &&
    formData.alliance === recommendedAlliance &&
    formData.alliancePosition === recommendedPosition;

  const handleInputChange = (
    section: string,
    field: string,
    value: number | string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...((prev[section as keyof DynamicMatchData] as Record<
          string,
          number | string | boolean
        >) || {}),
        [field]: value,
      },
    }));
  };

  const handleBasicInputChange = (
    field: keyof DynamicMatchData,
    value: string | number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAllianceChange = (alliance: "red" | "blue", position: number) => {
    setFormData((prev) => ({
      ...prev,
      alliance,
      alliancePosition: position,
    }));
  };

  const handleNumberChange = (
    section: string,
    field: string,
    increment: boolean,
  ) => {
    const currentValue =
      ((
        formData[section as keyof DynamicMatchData] as Record<
          string,
          number | string | boolean
        >
      )[field] as number) || 0;
    const newValue = Math.max(0, currentValue + (increment ? 1 : -1));
    handleInputChange(section, field, newValue);
  };

  const handleSubmit = async () => {
    if (submitInFlightRef.current || isSubmitting) {
      return;
    }

    if (!formData.matchNumber || !formData.teamNumber) {
      toast.error("Please fill in match number and team number");
      return;
    }

    // For tablet accounts, ensure a scout is selected
    if (session?.user?.role === "tablet" && !selectedScoutId && !isEditMode) {
      toast.error("Please select which scout you're entering data for");
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      // Check for duplicate match scout entry (only for new entries, not edits)
      if (!isEditMode && selectedEvent?.eventCode) {
        try {
          const response = await fetch(
            `/api/scouting/entries/match/check?teamNumber=${formData.teamNumber}&matchNumber=${formData.matchNumber}&eventCode=${selectedEvent.eventCode}`,
          );
          const data = await response.json();

          if (data.exists) {
            toast.error("Duplicate entry detected", {
              description: `Team ${formData.teamNumber} has already been scouted for Match ${formData.matchNumber}. Please check existing entries or edit the existing entry.`,
              icon: <AlertCircle className="h-4 w-4" />,
            });
            return;
          }
        } catch (error) {
          console.error("Error checking for duplicate:", error);
        }
      }

      if (isEditMode && editingEntryId) {
        // Update existing entry
        const response = await fetch("/api/scouting/entries/match", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: editingEntryId,
            matchNumber: formData.matchNumber,
            teamNumber: formData.teamNumber,
            year: currentYear,
            competitionType: competitionType,
            alliance: formData.alliance,
            alliancePosition: formData.alliancePosition,
            eventName: selectedEvent?.name || "Unknown Event",
            eventCode: selectedEvent?.eventCode || "Unknown Code",
            gameSpecificData: {
              autonomous: formData.autonomous,
              teleop: formData.teleop,
              endgame: formData.endgame,
              fouls: formData.fouls,
            },
            notes: formData.notes,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update match entry");
        }

        toast.success("Match entry updated!", {
          description: `Match ${formData.matchNumber} for Team ${formData.teamNumber} updated successfully`,
          icon: <CheckCircle className="h-4 w-4" />,
        });

        router.push("/dashboard/matchscouting");
      } else {
        // Create new entry
        const entryToSave = {
          matchNumber: formData.matchNumber,
          teamNumber: formData.teamNumber,
          year: currentYear,
          competitionType: competitionType,
          alliance: formData.alliance,
          alliancePosition: formData.alliancePosition,
          eventName: selectedEvent?.name || "Unknown Event",
          eventCode: selectedEvent?.eventCode || "Unknown Code",
          gameSpecificData: {
            autonomous: formData.autonomous,
            teleop: formData.teleop,
            endgame: formData.endgame,
            fouls: formData.fouls,
          },
          notes: formData.notes,
          timestamp: new Date(),
          ...(session?.user?.role === "tablet" && selectedScoutId
            ? { scoutingForUserId: selectedScoutId }
            : {}),
        };

        const result = await matchApi.create(entryToSave);

        if (result.isQueued) {
          toast.success("Data queued for sync", {
            description: `Match ${formData.matchNumber} for Team ${formData.teamNumber} saved offline. Will sync when online.`,
            icon: <Clock className="h-4 w-4" />,
          });
        } else {
          toast.success("Match data saved!", {
            description: `Match ${formData.matchNumber} for Team ${formData.teamNumber} saved successfully`,
            icon: <CheckCircle className="h-4 w-4" />,
          });
        }

        // Persist last submitted match number for this event
        const submittedMatch = Number(formData.matchNumber);
        if (selectedEvent?.eventCode) {
          setLastSubmittedMatch(selectedEvent.eventCode, submittedMatch);
        }

        // Compute next scheduled assignment from scouting schedule
        const nextMatch = submittedMatch + 1;
        const nextAssignment = hasAssignments
          ? getNextAssignment(submittedMatch)
          : null;

        const newFormData = gameConfig
          ? initializeFormData(gameConfig)
          : defaultData;
        newFormData.matchNumber = nextAssignment?.matchNumber ?? nextMatch;

        let nextAlliance = formData.alliance;
        let nextAlliancePosition = formData.alliancePosition || 1;

        if (nextAssignment) {
          nextAlliance = nextAssignment.alliance;
          nextAlliancePosition = nextAssignment.position;
        }

        // Keep current alliance/position when there's no assignment for the next match
        newFormData.alliance = nextAlliance;
        newFormData.alliancePosition = nextAlliancePosition;

        // Auto-populate team number for the next selected match/alliance/position when schedule data is available
        const nextTeamNumber = getTeamForPosition(
          newFormData.matchNumber,
          nextAlliance,
          nextAlliancePosition,
        );
        if (nextTeamNumber !== null) {
          newFormData.teamNumber = nextTeamNumber;
        }

        setLastSavedEntry({
          matchNumber: submittedMatch,
          teamNumber: Number(formData.teamNumber),
          nextMatchNumber: Number(newFormData.matchNumber),
          queued: result.isQueued,
        });
        setFormData(newFormData);
        setActiveTab("auto");
      }
    } catch (error) {
      toast.error("Failed to save data", {
        description: error instanceof Error ? error.message : "Unknown error",
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setIsSubmitting(false);
      submitInFlightRef.current = false;
    }
  };

  // Swipe handlers with animation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    setIsTransitioning(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!contentRef.current) return;

    touchEndX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);

    // Prevent swiping beyond boundaries
    if (
      (currentIndex === 0 && diff < 0) ||
      (currentIndex === tabs.length - 1 && diff > 0)
    ) {
      // Allow a small rubber band effect at boundaries
      setSwipeOffset(diff * 0.1);
    } else {
      // Normal swipe
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 75;
    const diff = touchStartX.current - touchEndX.current;
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && currentIndex < tabs.length - 1) {
        // Swipe left - go to next tab
        setSwipeDirection("left");
        setIsTransitioning(true);
        setActiveTab(tabs[currentIndex + 1].id);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - go to previous tab
        setSwipeDirection("right");
        setIsTransitioning(true);
        setActiveTab(tabs[currentIndex - 1].id);
      } else {
        // Swipe didn't reach threshold or at boundary - snap back
        setIsTransitioning(true);
      }
    } else {
      // Swipe didn't reach threshold - snap back
      setIsTransitioning(true);
    }

    // Reset swipe offset immediately
    setSwipeOffset(0);

    // Clear transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
      setSwipeDirection(null);
    }, 300);

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const goToNextTab = () => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < tabs.length - 1) {
      setSwipeDirection("left");
      setIsTransitioning(true);
      setActiveTab(tabs[currentIndex + 1].id);
      setTimeout(() => {
        setIsTransitioning(false);
        setSwipeDirection(null);
      }, 300);
    }
  };

  const goToPreviousTab = () => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex > 0) {
      setSwipeDirection("right");
      setIsTransitioning(true);
      setActiveTab(tabs[currentIndex - 1].id);
      setTimeout(() => {
        setIsTransitioning(false);
        setSwipeDirection(null);
      }, 300);
    }
  };

  return (
    <>
      <style>{hideSpinnersStyle}</style>
      <style>{`
        .swipe-container {
          transform: translateX(${-swipeOffset}px);
          transition: ${isTransitioning ? "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : "none"};
          will-change: transform;
        }
        
        .tab-content-wrapper {
          overflow-x: hidden;
          position: relative;
        }
        
        @keyframes slideInFromRight {
          from {
            opacity: 0.5;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideInFromLeft {
          from {
            opacity: 0.5;
            transform: translateX(-100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        ${
          swipeDirection
            ? `
          .tab-slide-animation[data-state="active"] {
            animation: ${swipeDirection === "left" ? "slideInFromRight" : "slideInFromLeft"} 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
        `
            : ""
        }
      `}</style>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="text-lg px-4 py-2">
            {gameConfig?.gameName || "Unknown Game"} -{" "}
            {isEditMode ? "Edit Match Entry" : "Match Scouting"}
          </Badge>
        </div>

        {isLoadingEdit && (
          <Card className="border rounded-xl shadow-sm">
            <CardContent className="pt-6 text-center">
              <div className="text-muted-foreground">
                Loading entry for editing...
              </div>
            </CardContent>
          </Card>
        )}

        {lastSavedEntry && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4"
          >
            {lastSavedEntry.queued ? (
              <Clock className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <CheckCircle className="mt-0.5 size-5 shrink-0 text-primary" />
            )}
            <div className="min-w-0">
              <p className="font-semibold">
                Match {lastSavedEntry.matchNumber} · Team {lastSavedEntry.teamNumber}{" "}
                {lastSavedEntry.queued ? "saved on this device" : "saved successfully"}
              </p>
              <p className="text-sm text-muted-foreground">
                {lastSavedEntry.queued
                  ? "It will sync automatically when a connection is available."
                  : `Match ${lastSavedEntry.nextMatchNumber} is ready below.`}
              </p>
            </div>
          </div>
        )}

        {session?.user && (
          <ScoutSelector
            selectedScoutId={selectedScoutId}
            onScoutChange={setSelectedScoutId}
            currentUserId={session.user.id || ""}
            currentUserRole={session.user.role || null}
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4">
            <TabsList className="w-full grid grid-cols-3 h-auto">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex flex-col gap-1 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {tab.icon}
                  <span className="text-xs">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="tab-content-wrapper">
            <div
              ref={contentRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="swipe-container relative touch-pan-y"
            >
              <TabsContent
                value="auto"
                className="space-y-6 mt-0 tab-slide-animation"
              >
                <MatchInfoSection
                  formData={formData}
                  competitionType={competitionType}
                  eventTeamNumbers={eventTeamNumbers}
                  teamsLoading={teamsLoading}
                  onBasicInputChange={handleBasicInputChange}
                  onAllianceChange={handleAllianceChange}
                  scheduleLoading={scheduleLoading}
                  hasScheduleData={hasScheduleData}
                  getTeamForPosition={getTeamForPosition}
                  isMatchFromScoutingSchedule={isMatchFromScoutingSchedule}
                  isAllianceFromScoutingSchedule={
                    isAllianceFromScoutingSchedule
                  }
                  assignmentLoading={assignmentLoading}
                />

                {gameConfig?.scoring?.autonomous && (
                  <ScoringSection
                    title="Autonomous Period"
                    description="Performance during the autonomous period"
                    icon={<Zap className="h-5 w-5" />}
                    section="autonomous"
                    scoringConfig={gameConfig.scoring.autonomous}
                    formData={formData}
                    gameConfig={gameConfig}
                    showStartPosition={true}
                    onInputChange={handleInputChange}
                    onNumberChange={handleNumberChange}
                  />
                )}
              </TabsContent>

              <TabsContent
                value="teleop"
                className="space-y-6 mt-0 tab-slide-animation"
              >
                {gameConfig?.scoring?.teleop && (
                  <ScoringSection
                    title="Teleop Period"
                    description="Driver-controlled period performance"
                    icon={<Award className="h-5 w-5" />}
                    section="teleop"
                    scoringConfig={gameConfig.scoring.teleop}
                    formData={formData}
                    onInputChange={handleInputChange}
                    onNumberChange={handleNumberChange}
                  />
                )}
              </TabsContent>

              <TabsContent
                value="endgame"
                className="space-y-6 mt-0 tab-slide-animation"
              >
                {gameConfig?.scoring?.endgame && (
                  <ScoringSection
                    title="Endgame"
                    icon={<AlertTriangle className="h-5 w-5" />}
                    section="endgame"
                    scoringConfig={gameConfig.scoring.endgame}
                    formData={formData}
                    onInputChange={handleInputChange}
                    onNumberChange={handleNumberChange}
                  />
                )}

                {gameConfig?.scoring?.fouls && (
                  <ScoringSection
                    title="Fouls & Penalties"
                    description="Track penalties and fouls committed"
                    icon={<AlertTriangle className="h-5 w-5" />}
                    section="fouls"
                    scoringConfig={gameConfig.scoring.fouls}
                    formData={formData}
                    onInputChange={handleInputChange}
                    onNumberChange={handleNumberChange}
                  />
                )}

                <Card className="border rounded-xl shadow-sm">
                  <CardContent className="space-y-2">
                    <label className="font-medium text-primary/90 font-semibold">
                      Additional Notes
                    </label>
                    <Textarea
                      placeholder="Any additional observations about this match..."
                      value={formData.notes}
                      onChange={(e) =>
                        handleBasicInputChange("notes", e.target.value)
                      }
                      className="focus:border-green-500 min-h-[200px] mt-2"
                      required={true}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={goToPreviousTab}
              disabled={activeTab === tabs[0].id}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-1">
              {tabs.map((tab, index) => (
                <div
                  key={tab.id}
                  className={`h-2 w-2 rounded-full transition-all ${
                    activeTab === tab.id
                      ? "bg-primary w-6"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={goToNextTab}
              disabled={activeTab === tabs[tabs.length - 1].id}
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Tabs>

        <FormSubmitButtons
          isEditMode={isEditMode}
          isSubmitting={isSubmitting}
          onCancel={() => router.push("/dashboard/matchscouting")}
          onClear={() => {
            const freshData = gameConfig
              ? initializeFormData(gameConfig)
              : defaultData;
            setFormData((prev) => ({
              ...freshData,
              matchNumber: prev.matchNumber,
              teamNumber: prev.teamNumber,
              alliance: prev.alliance,
              alliancePosition: prev.alliancePosition,
            }));
          }}
          onSubmit={handleSubmit}
          submitText="Save Data"
          updateText="Update Entry"
        />
      </div>
    </>
  );
}
