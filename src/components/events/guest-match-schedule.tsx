"use client";

import { useMatchScheduleTeams } from "@/hooks/use-match-schedule-teams";
import { Button } from "@/components/ui/button";

export function GuestMatchSchedule() {
  const { scheduleData, isLoading, error, refreshSchedule } = useMatchScheduleTeams();
  return <div className="space-y-4"><div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Match schedule</h1><Button variant="outline" onClick={refreshSchedule}>Refresh</Button></div>
    <p className="text-muted-foreground">Event match schedule and alliance teams.</p>
    {isLoading && <p>Loading schedule…</p>}{error && <p role="alert">{error}</p>}
    {!isLoading && !error && !scheduleData?.matches.length && <p>No match schedule available yet.</p>}
    <div className="grid gap-4 md:grid-cols-2">{scheduleData?.matches.map((match) => <article key={`${match.compLevel}:${match.matchNumber}`} className="rounded-xl border p-4 space-y-2"><h2 className="font-semibold">Match {match.matchNumber}</h2><p className="text-red-600">Red: {match.teams.filter((team) => team.alliance === "red").map((team) => team.teamNumber).join(", ")}</p><p className="text-blue-600">Blue: {match.teams.filter((team) => team.alliance === "blue").map((team) => team.teamNumber).join(", ")}</p></article>)}</div>
  </div>;
}
