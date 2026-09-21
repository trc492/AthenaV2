"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  RadioTower,
  Target,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLastSubmittedMatch } from "@/components/forms/match-form-utils";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useEventConfig } from "@/hooks/use-event-config";
import { useOffline } from "@/hooks/use-offline";
import { useScoutingAssignment } from "@/hooks/use-scouting-assignment";

const subscribeToLocalStorage = () => () => undefined;

function progressPercent(current: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (current / total) * 100));
}

export default function Page() {
  const { selectedEvent, isLoading: eventLoading } = useEventConfig();
  const { stats, loading, error } = useDashboardStats();
  const { isOnline, pendingCount, syncInProgress } = useOffline();
  const {
    getNextAssignment,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useScoutingAssignment();

  const lastSubmittedMatch = useSyncExternalStore(
    subscribeToLocalStorage,
    () =>
      selectedEvent?.eventCode
        ? getLastSubmittedMatch(selectedEvent.eventCode)
        : 0,
    () => 0,
  );
  const nextAssignment = getNextAssignment(lastSubmittedMatch);
  const missingPitTeams = Math.max(
    0,
    stats.pitScoutingProgress.total - stats.pitScoutingProgress.current,
  );
  const missingMatches = Math.max(
    0,
    stats.qualificationProgress.total - stats.qualificationProgress.current,
  );
  const defaultView = stats.eventComplete ? "review" : "live";

  if (eventLoading) {
    return (
      <div className="space-y-4" aria-live="polite">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-muted" />
        <div className="grid gap-6 pt-4 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-xl bg-muted" />
          <div className="h-56 animate-pulse rounded-xl bg-muted" />
        </div>
        <span className="sr-only">Loading event overview</span>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center">
        <Card className="w-full border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 rounded-full bg-primary/10 p-3 text-primary">
              <MapPin className="size-6" />
            </div>
            <CardTitle className="text-xl">Choose an event to begin</CardTitle>
            <CardDescription>
              Select an event from the sidebar to load assignments, scouting
              coverage, and strategy insights.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <Badge variant={stats.eventComplete ? "secondary" : "default"}>
              {stats.eventComplete ? "Event complete" : "Live workspace"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Your operational view for {selectedEvent.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="max-w-full gap-1.5 py-1.5">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{selectedEvent.name}</span>
          </Badge>
          <Badge
            variant="outline"
            className={isOnline ? "gap-1.5 py-1.5" : "gap-1.5 border-destructive py-1.5 text-destructive"}
          >
            {isOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          {(pendingCount > 0 || syncInProgress) && (
            <Badge variant="secondary" className="gap-1.5 py-1.5">
              <Clock className="size-3.5" />
              {syncInProgress ? "Syncing" : `${pendingCount} queued`}
            </Badge>
          )}
        </div>
      </div>

      <Tabs key={defaultView} defaultValue={defaultView} className="space-y-6">
        <TabsList className="grid h-11 w-full grid-cols-2 sm:w-[360px]">
          <TabsTrigger value="live" className="gap-2">
            <RadioTower className="size-4" />
            Live operations
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <BarChart3 className="size-4" />
            Review event
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="border-primary/30 bg-primary/[0.035]">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardDescription className="font-semibold uppercase tracking-wide text-primary">
                      Next assignment
                    </CardDescription>
                    <CardTitle className="mt-1 text-2xl">
                      {assignmentsLoading
                        ? "Loading your schedule…"
                        : nextAssignment
                          ? `Match ${nextAssignment.matchNumber}`
                          : "No upcoming assignment"}
                    </CardTitle>
                  </div>
                  {nextAssignment && (
                    <Badge
                      className={
                        nextAssignment.alliance === "red"
                          ? "bg-red-600 text-white"
                          : "bg-blue-600 text-white"
                      }
                    >
                      {nextAssignment.alliance === "red" ? "Red" : "Blue"} {nextAssignment.position}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {assignmentsError ? (
                  <p className="text-sm text-destructive">
                    Your assignment could not be loaded. You can still scout manually.
                  </p>
                ) : nextAssignment ? (
                  <p className="text-sm text-muted-foreground">
                    Your match, alliance, position, and team will be filled from the event schedule.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You have no remaining scheduled assignments. Start a manual entry or check the schedule.
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="h-11 sm:min-w-48">
                    <Link href="/scout/matchscout">
                      <ClipboardList className="size-4" />
                      {nextAssignment ? "Start assigned match" : "Start match scouting"}
                      <ArrowRight className="ml-auto size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-11">
                    <Link href="/scout/pitscout">
                      <Users className="size-4" />
                      Start pit scouting
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="lg" className="h-11">
                    <Link href="/dashboard/schedule">View schedule</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="size-5" />
                  Coverage
                </CardTitle>
                <CardDescription>Current scouting completion</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ProgressRow
                  label="Pit scouting"
                  current={stats.pitScoutingProgress.current}
                  total={stats.pitScoutingProgress.total}
                  loading={loading}
                />
                <ProgressRow
                  label="Qualification matches"
                  current={stats.qualificationProgress.current}
                  total={stats.qualificationProgress.total}
                  loading={loading}
                />
                <div className="flex items-center justify-between border-t pt-4 text-sm">
                  <span className="text-muted-foreground">Data completeness</span>
                  <span className="font-semibold">
                    {loading ? "…" : `${stats.dataQuality.toFixed(1)}%`}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5" />
                  Attention needed
                </CardTitle>
                <CardDescription>Items that may affect event coverage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Checking event coverage…</p>
                ) : missingPitTeams === 0 && missingMatches === 0 && pendingCount === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3 text-sm">
                    <CheckCircle2 className="size-5 text-primary" />
                    Scouting coverage is up to date.
                  </div>
                ) : (
                  <>
                    {missingPitTeams > 0 && (
                      <AttentionItem
                        label={`${missingPitTeams} ${missingPitTeams === 1 ? "team needs" : "teams need"} pit scouting`}
                        href="/dashboard/pitscouting"
                      />
                    )}
                    {missingMatches > 0 && (
                      <AttentionItem
                        label={`${missingMatches} ${missingMatches === 1 ? "match is" : "matches are"} not yet covered`}
                        href="/dashboard/matchscouting"
                      />
                    )}
                    {pendingCount > 0 && (
                      <AttentionItem
                        label={`${pendingCount} ${pendingCount === 1 ? "entry is" : "entries are"} waiting to sync`}
                        href="/dashboard/settings"
                      />
                    )}
                  </>
                )}
                {error && (
                  <p className="text-sm text-destructive">
                    Some overview data could not be refreshed.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent entries</CardTitle>
                <CardDescription>Latest match data received</CardDescription>
              </CardHeader>
              <CardContent>
                <RecentActivity loading={loading} activity={stats.recentActivity} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="review" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Teams scouted" value={loading ? "…" : stats.teamsScouted} icon={Users} />
            <StatCard label="Match entries" value={loading ? "…" : stats.matchesRecorded} icon={ClipboardList} />
            <StatCard
              label="Team ranking"
              value={loading ? "…" : stats.ranking > 0 ? `#${stats.ranking}` : "—"}
              icon={Trophy}
            />
            <StatCard
              label="Data completeness"
              value={loading ? "…" : `${stats.dataQuality.toFixed(1)}%`}
              icon={CheckCircle2}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Performance snapshot</CardTitle>
                    <CardDescription>Highest EPA teams from current data</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/analysis">Full analysis</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading performance data…</p>
                ) : stats.topTeams.length > 0 ? (
                  stats.topTeams.slice(0, 5).map((team, index) => (
                    <Link
                      key={team.teamNumber}
                      href={`/dashboard/team/${team.teamNumber}`}
                      className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="w-8 justify-center">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">Team {team.teamNumber}</p>
                          <p className="text-xs text-muted-foreground">{team.name}</p>
                        </div>
                      </div>
                      <Badge>{team.epa.toFixed(1)} EPA</Badge>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No performance data is available yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>Event record</CardTitle>
                    <CardDescription>Coverage and latest submissions</CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/teamlist">Browse teams</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <ProgressRow
                  label="Pit scouting"
                  current={stats.pitScoutingProgress.current}
                  total={stats.pitScoutingProgress.total}
                  loading={loading}
                />
                <ProgressRow
                  label="Qualification matches"
                  current={stats.qualificationProgress.current}
                  total={stats.qualificationProgress.total}
                  loading={loading}
                />
                <RecentActivity loading={loading} activity={stats.recentActivity.slice(0, 3)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProgressRow({
  label,
  current,
  total,
  loading,
}: {
  label: string;
  current: number;
  total: number;
  loading: boolean;
}) {
  const value = progressPercent(current, total);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{loading ? "…" : `${current}/${total}`}</span>
      </div>
      <Progress value={loading ? 0 : value} aria-label={`${label} completion`} />
    </div>
  );
}

function AttentionItem({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted"
    >
      <span>{label}</span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function RecentActivity({
  loading,
  activity,
}: {
  loading: boolean;
  activity: Array<{ message: string; timestamp: Date }>;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading recent entries…</p>;
  }
  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground">No entries have been recorded yet.</p>;
  }
  return (
    <div className="space-y-3">
      {activity.slice(0, 5).map((item, index) => (
        <div key={`${item.timestamp.toISOString()}-${index}`} className="flex gap-3">
          <div className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.message}</p>
            <p className="text-xs text-muted-foreground">
              {item.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
