"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useSelectedEvent } from "@/hooks/use-event-config";
import { useGameConfig } from "@/hooks/use-game-config";
import {
  buildSteps,
  FULL_CACHE_STEPS,
  runEventCache,
  SCOUT_STEPS,
  type CacheStep,
  type CacheStepId,
} from "@/lib/event-cache-manager";
import { indexedDBService } from "@/lib/indexeddb-service";
import type { EventCacheStatus } from "@/lib/offline-types";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle,
  ClipboardList,
  Database,
  Download,
  FileText,
  HardDriveDownload,
  Layout,
  Loader2,
  Shield,
  Trash2,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type CacheMode = "scout" | "full";

const STEP_ICONS: Record<CacheStepId, LucideIcon> = {
  session: Shield,
  pages: Layout,
  teams: Users,
  schedule: Calendar,
  scoutSchedule: ClipboardList,
  scoutList: Users,
  pitEntries: FileText,
  matchEntries: Database,
  analysisData: BarChart3,
};

function StepRow({ step }: { step: CacheStep }) {
  const Icon = STEP_ICONS[step.id];

  return (
    <div className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-md bg-muted/40">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="truncate flex-1">{step.label}</span>
      {step.status === "pending" && (
        <span className="text-muted-foreground text-xs shrink-0">Waiting</span>
      )}
      {step.status === "loading" && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
      )}
      {step.status === "success" && (
        <div className="flex items-center gap-1.5 shrink-0">
          {step.detail && (
            <span className="text-xs text-muted-foreground">{step.detail}</span>
          )}
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        </div>
      )}
      {step.status === "error" && (
        <div className="flex items-center gap-1.5 text-destructive shrink-0">
          <span className="text-xs">{step.error || "Failed"}</span>
          <AlertCircle className="h-3.5 w-3.5" />
        </div>
      )}
      {step.status === "skipped" && (
        <span className="text-muted-foreground text-xs shrink-0">Skipped</span>
      )}
    </div>
  );
}

function formatTimeSince(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function OfflinePrecache({ className }: { className?: string }) {
  const { data: session } = useSession();
  const selectedEvent = useSelectedEvent();
  const { competitionType, currentYear } = useGameConfig();

  const [mode, setMode] = useState<CacheMode>("scout");
  const [isCaching, setIsCaching] = useState(false);
  const [steps, setSteps] = useState<CacheStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [cacheStatus, setCacheStatus] = useState<EventCacheStatus | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const hasEvent = !!selectedEvent?.eventCode;

  // Clear the previous event's cache status as soon as the event changes
  const eventCode = selectedEvent?.eventCode;
  const scopeKey = `${eventCode}|${currentYear}|${competitionType}`;
  const [statusEventCode, setStatusEventCode] = useState(scopeKey);
  if (statusEventCode !== scopeKey) {
    setStatusEventCode(scopeKey);
    setCacheStatus(null);
  }

  // Load existing cache status for the selected event
  useEffect(() => {
    if (!eventCode) return;
    let cancelled = false;
    indexedDBService
      .getEventCacheStatus({ eventCode, competitionType, year: currentYear })
      .catch(() => null)
      .then((status) => {
        if (!cancelled) setCacheStatus(status);
      });
    return () => {
      cancelled = true;
    };
  }, [eventCode, competitionType, currentYear]);

  const currentStepIds = mode === "full" ? FULL_CACHE_STEPS : SCOUT_STEPS;

  const handleStepUpdate = useCallback(
    (stepId: CacheStepId, update: Partial<CacheStep>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, ...update } : s)),
      );
    },
    [],
  );

  const handleCache = async () => {
    if (!navigator.onLine) {
      toast.error("You must be online to cache data");
      return;
    }

    if (!selectedEvent?.eventCode) {
      toast.error("Select an event first");
      return;
    }

    const stepList = buildSteps(currentStepIds);
    setSteps(stepList);
    setIsCaching(true);
    setProgress(0);

    // Track progress via step updates
    let completedCount = 0;
    const totalSteps = stepList.length;

    const trackingUpdate = (
      stepId: CacheStepId,
      update: Partial<CacheStep>,
    ) => {
      handleStepUpdate(stepId, update);
      if (
        update.status === "success" ||
        update.status === "error" ||
        update.status === "skipped"
      ) {
        completedCount++;
        setProgress(Math.round((completedCount / totalSteps) * 100));
      }
    };

    try {
      const result = await runEventCache(mode, {
        eventCode: selectedEvent.eventCode,
        eventName: selectedEvent.name || selectedEvent.eventCode,
        competitionType,
        year: currentYear,
        userRole: session?.user?.role || undefined,
        onStepUpdate: trackingUpdate,
      });

      setProgress(100);

      if (result.success) {
        toast.success(
          mode === "full"
            ? "Full event data cached for offline use"
            : "Scout mode data cached for offline use",
          {
            description:
              mode === "full"
                ? `${result.pitEntryCount} pit + ${result.matchEntryCount} match entries saved`
                : `${result.teamCount} teams + schedules cached`,
          },
        );
      } else {
        toast.warning("Some items failed to cache", {
          description: "Check the status below for details",
        });
      }

      // Refresh cache status
      if (mode === "full") {
        const status = await indexedDBService.getEventCacheStatus(
          { eventCode: selectedEvent.eventCode, competitionType, year: currentYear },
        );
        setCacheStatus(status);
      }
    } catch {
      toast.error("Caching failed unexpectedly");
    } finally {
      setIsCaching(false);
    }
  };

  const handleClearCache = async () => {
    if (!selectedEvent?.eventCode) return;

    setIsClearing(true);
    try {
      await indexedDBService.clearEventCache({ eventCode: selectedEvent.eventCode, competitionType, year: currentYear });
      setCacheStatus(null);
      setSteps([]);
      setProgress(0);
      toast.success("Event cache cleared");
    } catch {
      toast.error("Failed to clear cache");
    } finally {
      setIsClearing(false);
    }
  };

  const successCount = steps.filter((s) => s.status === "success").length;
  const errorCount = steps.filter((s) => s.status === "error").length;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Offline Caching
        </CardTitle>
        <CardDescription>
          Download data for offline use at competitions. Choose between
          lightweight scouting mode or a full event cache with all scouting
          data.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Event status */}
        {hasEvent ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="text-primary border-primary">
              {selectedEvent?.name}
            </Badge>
            {cacheStatus && (
              <Badge variant="secondary" className="text-xs">
                Last cached {formatTimeSince(cacheStatus.cachedAt)}
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Select an event from the sidebar to enable caching.
          </div>
        )}

        {/* Mode selector */}
        {hasEvent && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => !isCaching && setMode("scout")}
              disabled={isCaching}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                mode === "scout"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/30"
              } ${isCaching ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center gap-2 font-medium text-sm">
                <Download className="h-4 w-4" />
                Scout Mode
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pages, teams &amp; schedules. Enough to scout matches offline.
              </p>
              {mode === "scout" && (
                <div className="absolute right-2 top-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => !isCaching && setMode("full")}
              disabled={isCaching}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                mode === "full"
                  ? "border-primary bg-primary/5"
                  : "border-muted hover:border-muted-foreground/30"
              } ${isCaching ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center gap-2 font-medium text-sm">
                <HardDriveDownload className="h-4 w-4" />
                Full Event Cache
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Everything above + all pit &amp; match scouting entries for
                analysis.
              </p>
              {mode === "full" && (
                <div className="absolute right-2 top-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
              )}
            </button>
          </div>
        )}

        {/* Existing cache info */}
        {cacheStatus && (
          <>
            <Separator />
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cached Event Data</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCache}
                  disabled={isClearing || isCaching}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  {isClearing ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-3 w-3" />
                  )}
                  Clear
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  {cacheStatus.teamCount} teams
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  {cacheStatus.pitEntryCount} pit entries
                </div>
                <div className="flex items-center gap-1.5">
                  <Database className="h-3 w-3" />
                  {cacheStatus.matchEntryCount} match entries
                </div>
              </div>
            </div>
          </>
        )}

        {/* Progress */}
        {(isCaching || steps.length > 0) && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{isCaching ? "Downloading..." : "Complete"}</span>
                  <span>
                    {successCount}/{steps.length} done
                    {errorCount > 0 && ` · ${errorCount} failed`}
                  </span>
                </div>
              </div>

              {/* Step list */}
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {steps.map((step) => (
                  <StepRow key={step.id} step={step} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Action button */}
        {hasEvent && (
          <Button
            onClick={handleCache}
            disabled={isCaching || !navigator.onLine}
            className="w-full"
            size="lg"
          >
            {isCaching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Caching {mode === "full" ? "Event Data" : "Scout Data"}...
              </>
            ) : !navigator.onLine ? (
              <>
                <WifiOff className="mr-2 h-4 w-4" />
                Offline — Connect to Cache
              </>
            ) : steps.length > 0 &&
              errorCount === 0 &&
              successCount === steps.length ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Cached — Re-download
              </>
            ) : mode === "full" ? (
              <>
                <HardDriveDownload className="mr-2 h-4 w-4" />
                Cache Full Event Data
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Cache for Scouting
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
