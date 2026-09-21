"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGameConfig, useCurrentGameConfig } from "@/hooks/use-game-config";
import { useSelectedEvent } from "@/hooks/use-event-config";
import { useEventTeamNumbers, useEventTeams } from "@/hooks/use-event-teams";
import { useUnscoutedEventTeamNumbers } from "@/hooks/use-unscouted-event-teams";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { pitApi } from "@/lib/api/database-client";
import { ScoutSelector } from "@/components/scout-selector";
import { FieldDrawingCanvas } from "@/components/forms/field-drawing-canvas";
import type { PitEntry } from "@/lib/types";
import type {
  DynamicPitData,
  PitScoutingFieldDefinition,
  YearConfig,
} from "@/lib/types";

export function DynamicPitScoutForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
  const gameConfig = useCurrentGameConfig();
  const { competitionType, currentYear } = useGameConfig();
  const selectedEvent = useSelectedEvent();
  const eventTeamNumbers = useEventTeamNumbers();
  const { loading: teamsLoading } = useEventTeams();
  const { teamNumbers: unscoutedTeamNumbers, loading: unscoutedLoading } =
    useUnscoutedEventTeamNumbers();
  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedEntry, setLastSavedEntry] = useState<{
    teamNumber: number;
    queued: boolean;
  } | null>(null);

  // Function to initialize form data with all pit scouting fields
  const initializePitFormData = (config: YearConfig): DynamicPitData => {
    const data: DynamicPitData = {
      team: 0,
      drivetrain: "",
      weight: "",
      length: "",
      width: "",
      hasAuto: false,
      autoDrawing: "",
      notes: "",
      gameSpecificData: {},
    };

    // Initialize fields for each category
    (["autonomous", "teleoperated", "driveTeam", "endgame"] as const).forEach(
      (category) => {
        const fields: Record<string, PitScoutingFieldDefinition> | undefined =
          config?.pitScouting?.[category];
        if (fields) {
          Object.entries(fields).forEach(
            ([fieldName, fieldConfig]) => {
              switch (fieldConfig.type) {
                case "text":
                  data.gameSpecificData[`${category}_${fieldName}`] = "";
                  break;
                case "number":
                  data.gameSpecificData[`${category}_${fieldName}`] = 0;
                  break;
                case "boolean":
                  data.gameSpecificData[`${category}_${fieldName}`] = false;
                  break;
                case "select":
                  data.gameSpecificData[`${category}_${fieldName}`] =
                    fieldConfig.options && fieldConfig.options.length > 0
                      ? fieldConfig.options[0]
                      : "";
                  break;
                default:
                  data.gameSpecificData[`${category}_${fieldName}`] = "";
              }
            },
          );
        }
      },
    );

    return data;
  };

  const [formData, setFormData] = useState<DynamicPitData>(() =>
    gameConfig
      ? initializePitFormData(gameConfig)
      : {
          team: 0,
          drivetrain: "",
          weight: "",
          length: "",
          width: "",
          hasAuto: false,
          autoDrawing: "",
          notes: "",
          gameSpecificData: {},
        },
  );

  // Fetch entry for editing
  useEffect(() => {
    let isMounted = true;

    const fetchEntryForEdit = async () => {
      if (!editId || !gameConfig) return;

      setIsLoadingEdit(true);
      try {
        const response = await fetch(`/api/scouting/entries/pit?id=${editId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch entry for editing");
        }

        const entry: PitEntry = await response.json();

        if (!isMounted) return;

        // Populate form with existing data
        const gameData = { ...entry.gameSpecificData };
        const hasAuto = Boolean(gameData.hasAuto);
        delete gameData.hasAuto; // Remove hasAuto from gameSpecificData

        const populatedData: DynamicPitData = {
          team: entry.teamNumber,
          drivetrain: entry.driveTrain.toLowerCase(),
          weight:
            entry.weight !== null && entry.weight !== undefined
              ? String(entry.weight)
              : "",
          length:
            entry.length !== null && entry.length !== undefined
              ? String(entry.length)
              : "",
          width:
            entry.width !== null && entry.width !== undefined
              ? String(entry.width)
              : "",
          hasAuto,
          autoDrawing: entry.autoDrawing || "",
          notes: typeof entry.notes === "string" ? entry.notes : "",
          gameSpecificData: gameData as Record<
            string,
            number | string | boolean
          >,
        };

        setFormData(populatedData);
        setIsEditMode(true);
        setEditingEntryId(entry.id ?? null);

        toast.info("Editing entry", {
          description: `Team ${entry.teamNumber}`,
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
      setFormData(initializePitFormData(gameConfig));
    }
  }, [gameConfig, isEditMode]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    if (name === "team") {
      setFormData((f) => ({ ...f, [name]: Number(value) }));
    } else {
      setFormData((f) => ({ ...f, [name]: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === "team") {
      setFormData((f) => ({ ...f, [name]: Number(value) }));
    } else {
      setFormData((f) => ({ ...f, [name]: value }));
    }
  };

  const handleGameSpecificChange = (
    field: string,
    value: number | string | boolean | string[],
  ) => {
    setFormData((f) => ({
      ...f,
      gameSpecificData: { ...f.gameSpecificData, [field]: value },
    }));
  };

  const handleToggleAuto = (checked: boolean) => {
    setFormData((f) => ({ ...f, hasAuto: checked }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    // For tablet accounts, ensure a scout is selected
    if (session?.user?.role === "tablet" && !selectedScoutId && !isEditMode) {
      toast.error("Please select which scout you're entering data for");
      return;
    }

    setIsSubmitting(true);

    try {
      // Check for duplicate pit scout entry (only for new entries, not edits)
      if (!isEditMode && selectedEvent?.eventCode) {
        try {
          const response = await fetch(
            `/api/scouting/entries/pit/check?teamNumber=${formData.team}&eventCode=${selectedEvent.eventCode}`,
          );
          const data = await response.json();

          if (data.exists) {
            toast.error("Duplicate entry detected", {
              description: `Team ${formData.team} has already been pit scouted for this event. Please check existing entries or edit the existing entry.`,
              icon: <AlertCircle className="h-4 w-4" />,
            });
            return;
          }
        } catch (error) {
          console.error("Error checking for duplicate:", error);
          // Continue with submission even if check fails
        }
      }

      if (isEditMode && editingEntryId) {
        // Update existing entry
        const response = await fetch("/api/scouting/entries/pit", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: editingEntryId,
            teamNumber: Number(formData.team),
            year: currentYear,
            competitionType: competitionType,
            driveTrain: (formData.drivetrain.charAt(0).toUpperCase() +
              formData.drivetrain.slice(1)) as
              | "Swerve"
              | "Mecanum"
              | "Tank"
              | "Other",
            weight: formData.weight
              ? parseFloat(formData.weight as string)
              : undefined,
            length: formData.length
              ? parseFloat(formData.length as string)
              : undefined,
            width: formData.width
              ? parseFloat(formData.width as string)
              : undefined,
            eventName: selectedEvent?.name || "Unknown Event",
            eventCode: selectedEvent?.eventCode || "Unknown Code",
            notes: formData.notes || "",
            autoDrawing: formData.autoDrawing || "",
            gameSpecificData: {
              hasAuto: formData.hasAuto,
              ...formData.gameSpecificData,
            },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update pit entry");
        }

        toast("Pit entry updated!", {
          description: `Team ${formData.team} updated successfully.`,
          icon: <CheckCircle className="h-4 w-4" />,
        });

        // Navigate back to dashboard
        router.push("/dashboard/pitscouting");
      } else {
        // Create new entry
        const entryToSave = {
          teamNumber: Number(formData.team),
          year: currentYear,
          competitionType: competitionType,
          driveTrain: formData.drivetrain as
            | "Swerve"
            | "Mecanum"
            | "Tank"
            | "Other",
          weight: formData.weight
            ? parseFloat(formData.weight as string)
            : undefined,
          length: formData.length
            ? parseFloat(formData.length as string)
            : undefined,
          width: formData.width
            ? parseFloat(formData.width as string)
            : undefined,
          eventName: selectedEvent?.name || "Unknown Event",
          eventCode: selectedEvent?.eventCode || "Unknown Code",
          notes: formData.notes || "",
          autoDrawing: formData.autoDrawing || "",
          gameSpecificData: {
            hasAuto: formData.hasAuto,
            ...formData.gameSpecificData,
          },
          // Include scout ID for tablet accounts
          ...(session?.user?.role === "tablet" && selectedScoutId
            ? { scoutingForUserId: selectedScoutId }
            : {}),
        };

        const result = await pitApi.create(entryToSave);

        if (result.isQueued) {
          toast("Data queued for sync", {
            description: `Team ${formData.team} entry saved offline. Will sync when online.`,
            icon: <Clock className="h-4 w-4" />,
          });
        } else {
          toast("Scouting data saved!", {
            description: `Team ${formData.team} entry stored successfully.`,
            icon: <CheckCircle className="h-4 w-4" />,
          });
        }

        setLastSavedEntry({
          teamNumber: entryToSave.teamNumber,
          queued: result.isQueued,
        });

        // Reset form
        setFormData(
          gameConfig
            ? initializePitFormData(gameConfig)
            : {
                team: 0,
                drivetrain: "",
                weight: "",
                length: "",
                width: "",
                hasAuto: false,
                autoDrawing: "",
                notes: "",
                gameSpecificData: {},
              },
        );
        // Notify local listeners (including our hook) that a pit entry was created so dropdown updates
        try {
          if (typeof window !== "undefined") {
            const ev = new CustomEvent("pitEntryCreated", {
              detail: { teamNumber: entryToSave.teamNumber },
            });
            window.dispatchEvent(ev);
          }
        } catch (err) {
          // ignore
        }
      }
    } catch (error) {
      toast("Failed to save data", {
        description: error instanceof Error ? error.message : "Unknown error",
        icon: <AlertCircle className="h-4 w-4" />,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCustomField = (field: {
    name: string;
    label: string;
    type: string;
    options?: string[];
  }) => {
    const value = formData.gameSpecificData[field.name] || "";

    switch (field.type) {
      case "text":
      case "number":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-base font-medium">
              {field.label}
            </Label>
            <Input
              id={field.name}
              name={field.name}
              type={field.type}
              value={String(value || "")}
              onChange={(e) =>
                handleGameSpecificChange(field.name, e.target.value)
              }
              className="h-12 text-base"
            />
          </div>
        );

      case "boolean":
        return (
          <div key={field.name} className="flex items-center space-x-4">
            <Switch
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) =>
                handleGameSpecificChange(field.name, checked)
              }
              className="scale-125"
            />
            <Label
              htmlFor={field.name}
              className="text-base font-medium cursor-pointer"
            >
              {field.label}
            </Label>
          </div>
        );

      case "select":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-base font-medium">
              {field.label}
            </Label>
            <Select
              value={String(value || "")}
              onValueChange={(value) =>
                handleGameSpecificChange(field.name, value)
              }
            >
              <SelectTrigger className="h-12 text-base">
                <SelectValue
                  placeholder={`Select ${field.label.toLowerCase()}`}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {field.options?.map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        );

      case "multiselect":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-base font-medium">
              {field.label}
            </Label>
            <MultiSelect
              options={field.options || []}
              selected={Array.isArray(value) ? value : []}
              onChange={(selected) =>
                handleGameSpecificChange(field.name, selected)
              }
              placeholder={`Select ${field.label.toLowerCase()}`}
              className="w-full"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Game Title */}
      <div className="text-center">
        <Badge variant="outline" className="text-lg px-4 py-2">
          {gameConfig?.gameName || "Unknown Game"} -{" "}
          {isEditMode ? "Edit Pit Entry" : "Pit Scouting"}
        </Badge>
      </div>

      {/* Loading indicator for edit mode */}
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
          <div>
            <p className="font-semibold">
              Team {lastSavedEntry.teamNumber}{" "}
              {lastSavedEntry.queued ? "saved on this device" : "saved successfully"}
            </p>
            <p className="text-sm text-muted-foreground">
              {lastSavedEntry.queued
                ? "It will sync automatically when a connection is available."
                : "The form is ready for the next team."}
            </p>
          </div>
        </div>
      )}

      {/* Scout Selector (for tablet accounts only) */}
      {session?.user && !isEditMode && (
        <ScoutSelector
          selectedScoutId={selectedScoutId}
          onScoutChange={setSelectedScoutId}
          currentUserId={session.user.id || ""}
          currentUserRole={session.user.role || null}
        />
      )}

      {/* Main Form */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Team Information */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h2 className="text-xl font-semibold mb-4">Team Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="team" className="text-base font-medium">
                      Team Number
                    </Label>
                    {isEditMode ? (
                      // In edit mode, show the team number as read-only or allow selection from all teams
                      eventTeamNumbers.length > 0 ? (
                        <Select
                          value={
                            formData.team === 0 ? "" : String(formData.team)
                          }
                          onValueChange={(value) =>
                            handleSelectChange("team", value)
                          }
                        >
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder="Select team number" />
                          </SelectTrigger>
                          <SelectContent>
                            {eventTeamNumbers.map((teamNumber) => (
                              <SelectItem
                                key={teamNumber}
                                value={String(teamNumber)}
                              >
                                Team {teamNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          name="team"
                          type="number"
                          value={formData.team}
                          onChange={handleChange}
                          placeholder="Enter team number (e.g. 254)"
                          required
                          min="1"
                          className="h-12 text-base"
                        />
                      )
                    ) : unscoutedTeamNumbers.length > 0 ? (
                      <Select
                        value={formData.team === 0 ? "" : String(formData.team)}
                        onValueChange={(value) =>
                          handleSelectChange("team", value)
                        }
                      >
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder="Select team number" />
                        </SelectTrigger>
                        <SelectContent>
                          {unscoutedTeamNumbers.map((teamNumber) => (
                            <SelectItem
                              key={teamNumber}
                              value={String(teamNumber)}
                            >
                              Team {teamNumber}
                            </SelectItem>
                          ))}
                          {unscoutedTeamNumbers.length === 0 &&
                            eventTeamNumbers.length > 0 && (
                              <SelectItem value="-" disabled>
                                All teams have pit entries
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                    ) : unscoutedLoading || teamsLoading ? (
                      <Select disabled>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue placeholder="Loading teams..." />
                        </SelectTrigger>
                      </Select>
                    ) : (
                      <Input
                        name="team"
                        type="number"
                        value={formData.team}
                        onChange={handleChange}
                        placeholder="Enter team number (e.g. 254)"
                        required
                        min="1"
                        max="9999"
                        className="h-12 text-base"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Robot Information */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold mb-4">
                  Robot Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="drivetrain"
                      className="text-base font-medium"
                    >
                      Drivetrain
                    </Label>
                    <Select
                      value={formData.drivetrain}
                      onValueChange={(value) =>
                        handleSelectChange("drivetrain", value)
                      }
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Select drivetrain" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="tank">Tank Drive</SelectItem>
                          <SelectItem value="mecanum">Mecanum Drive</SelectItem>
                          <SelectItem value="swerve">Swerve Drive</SelectItem>
                          <SelectItem value="west-coast">
                            West Coast Drive
                          </SelectItem>
                          <SelectItem value="omni">Omni Drive</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Robot Specifications */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold mb-4">
                  Robot Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="length" className="text-base font-medium">
                      Length (inches)
                    </Label>
                    <Input
                      name="length"
                      type="number"
                      step="0.01"
                      value={formData.length}
                      onChange={handleChange}
                      placeholder="30"
                      className="h-12 text-base"
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width" className="text-base font-medium">
                      Width (inches)
                    </Label>
                    <Input
                      name="width"
                      type="number"
                      step="0.01"
                      value={formData.width}
                      onChange={handleChange}
                      placeholder="30"
                      className="h-12 text-base"
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight" className="text-base font-medium">
                      Weight (lbs)
                    </Label>
                    <Input
                      name="weight"
                      type="number"
                      step="0.01"
                      value={formData.weight}
                      onChange={handleChange}
                      placeholder="125"
                      className="h-12 text-base"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Autonomous Capabilities */}
              <div
                className={`space-y-6 ${!formData.hasAuto ? "border-b pb-4" : ""}`}
              >
                <div className="flex items-center space-x-4">
                  <Switch
                    id="hasAuto"
                    checked={formData.hasAuto}
                    onCheckedChange={handleToggleAuto}
                    className="scale-125"
                  />
                  <Label
                    htmlFor="hasAuto"
                    className="text-base font-medium cursor-pointer"
                  >
                    Has Autonomous Capabilities
                  </Label>
                </div>
              </div>

              {/* Game-Specific Fields by Category */}
              {gameConfig?.pitScouting && (
                <>
                  {/* Autonomous */}
                  {gameConfig.pitScouting.autonomous &&
                    Object.keys(gameConfig.pitScouting.autonomous).length > 0 &&
                    formData.hasAuto && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-4">
                          Autonomous Capabilities
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {Object.entries(
                            gameConfig.pitScouting.autonomous,
                          ).map(([name, field]) =>
                            renderCustomField({
                              name: `autonomous_${name}`,
                              label: field.label,
                              type: field.type,
                              options: field.options,
                            }),
                          )}
                        </div>
                        {/* Field Drawing Canvas for Autonomous Path */}
                        <div className="mt-6">
                          <FieldDrawingCanvas
                            initialData={formData.autoDrawing}
                            onChange={(strokeJson) =>
                              setFormData((f) => ({
                                ...f,
                                autoDrawing: strokeJson,
                              }))
                            }
                          />
                        </div>
                      </div>
                    )}

                  {/* Autonomous path drawing when no autonomous fields configured */}
                  {(!gameConfig.pitScouting.autonomous ||
                    Object.keys(gameConfig.pitScouting.autonomous).length ===
                      0) &&
                    formData.hasAuto && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-4">
                          Autonomous Path
                        </h3>
                        <FieldDrawingCanvas
                          initialData={formData.autoDrawing}
                          onChange={(strokeJson) =>
                            setFormData((f) => ({
                              ...f,
                              autoDrawing: strokeJson,
                            }))
                          }
                        />
                      </div>
                    )}

                  {/* Teleoperated */}
                  {gameConfig.pitScouting.teleoperated &&
                    Object.keys(gameConfig.pitScouting.teleoperated).length >
                      0 && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-4">
                          Teleop Capabilities
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {Object.entries(
                            gameConfig.pitScouting.teleoperated,
                          ).map(([name, field]) =>
                            renderCustomField({
                              name: `teleoperated_${name}`,
                              label: field.label,
                              type: field.type,
                              options: field.options,
                            }),
                          )}
                        </div>
                      </div>
                    )}

                  {/* Drive Team */}
                  {gameConfig.pitScouting.driveTeam &&
                    Object.keys(gameConfig.pitScouting.driveTeam).length >
                      0 && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-4">
                          Drive Team
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {Object.entries(gameConfig.pitScouting.driveTeam).map(
                            ([name, field]) =>
                              renderCustomField({
                                name: `driveTeam_${name}`,
                                label: field.label,
                                type: field.type,
                                options: field.options,
                              }),
                          )}
                        </div>
                      </div>
                    )}

                  {/* Endgame */}
                  {gameConfig.pitScouting.endgame &&
                    Object.keys(gameConfig.pitScouting.endgame).length > 0 && (
                      <div className="border-b pb-4">
                        <h3 className="text-lg font-semibold mb-4">
                          Endgame Capabilities
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {Object.entries(gameConfig.pitScouting.endgame)
                            .filter(([, field]) => {
                              if (!field.dependsOn) return true;
                              const dependencyValue =
                                formData.gameSpecificData[
                                  `endgame_${field.dependsOn}`
                                ];
                              return Boolean(dependencyValue);
                            })
                            .map(([name, field]) =>
                              renderCustomField({
                                name: `endgame_${name}`,
                                label: field.label,
                                type: field.type,
                                options: field.options,
                              }),
                            )}
                        </div>
                      </div>
                    )}
                </>
              )}

              {/* Notes */}
              <div className="space-y-4">
                <Label htmlFor="notes" className="text-base font-medium">
                  Additional Notes
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleChange}
                  placeholder="Any additional observations about this team..."
                  className="min-h-[4rem]"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                {isEditMode ? (
                  <div className="flex flex-col md:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/dashboard/pitscouting")}
                      size="lg"
                      disabled={isSubmitting}
                      className="flex-1 h-12 text-base"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                      className="flex-1 h-12 text-base"
                    >
                      {isSubmitting ? (
                        "Updating..."
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-5 w-5" />
                          Update Entry
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting}
                    className="w-full h-12 text-base"
                  >
                    {isSubmitting ? (
                      "Saving..."
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Save Scouting Data
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
