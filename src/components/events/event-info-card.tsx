"use client";

import { useSelectedEvent } from "@/hooks/use-event-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GuestEventLink } from "./guest-event-link";
import { useGameConfig } from "@/hooks/use-game-config";

export function EventInfoCard() {
  const selectedEvent = useSelectedEvent();
  const { currentYear, competitionType } = useGameConfig();

  if (!selectedEvent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No event selected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 -mb-4">
          Event Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex">
            <p className="text-sm text-muted-foreground pr-4">
              {selectedEvent.name}
            </p>
            <Badge variant="secondary">{selectedEvent.eventCode}</Badge>
          </div>
        </div>
        <GuestEventLink key={`${competitionType}:${currentYear}:${selectedEvent.eventCode}`} event={selectedEvent} />
      </CardContent>
    </Card>
  );
}
