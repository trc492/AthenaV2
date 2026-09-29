import { Suspense } from "react";
import {
  Card,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeamMedia, getEventTeams } from "@/lib/api/tba";
import { getSelectedEvent } from "@/lib/server-event-utils";
import { DynamicTeamList } from "./dynamic-team-list";
import { TeamCardSkeleton } from "@/components/team-card-skeleton";
import type { TeamWithImages } from "@/lib/types";

// Server component to fetch initial teams and their images
async function InitialTeamList() {
  const selectedEvent = await getSelectedEvent();

  if (!selectedEvent?.eventCode) {
    return <DynamicTeamList initialEvent={selectedEvent} initialTeams={[]} />;
  }

  const teams = await loadTeamsWithImages(selectedEvent.eventCode);

  return <DynamicTeamList initialEvent={selectedEvent} initialTeams={teams} />;
}

async function loadTeamsWithImages(
  eventCode: string,
): Promise<TeamWithImages[]> {
  try {
    const teams = await getEventTeams(eventCode);
    // The event code starts with the year, e.g. "2024miket"
    const year = Number(eventCode.slice(0, 4));

    // Fetch images for all teams in parallel
    const teamsWithImages = await Promise.all(
      teams.map(async (team): Promise<TeamWithImages> => {
        try {
          const images = await getTeamMedia(team.team_number, year);
          return { ...team, images };
        } catch (error) {
          console.warn(
            `Failed to fetch images for team ${team.team_number}:`,
            error,
          );
          return { ...team, images: [] };
        }
      }),
    );

    // Sort teams by number
    return teamsWithImages.sort((a, b) => a.team_number - b.team_number);
  } catch (error) {
    console.error("Error fetching teams:", error);
    return [];
  }
}

// Loading skeleton component
function TeamListSkeleton() {
  return (
    <>
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Teams grid skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <TeamCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}

export default function TeamListPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Directory</h1>
        <p className="text-muted-foreground">
          Browse all teams competing at the selected event
        </p>
      </div>

      <Suspense fallback={<TeamListSkeleton />}>
        <InitialTeamList />
      </Suspense>
    </div>
  );
}
