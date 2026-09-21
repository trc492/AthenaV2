"use client";

import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeToggle } from "@/components/ui/light-dark-toggle";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { DynamicMatchScoutForm } from "@/components/forms/dynamic-match-scout-form";
import { OfflineStatusWidget } from "@/components/sync/offline-status-widget";
import { useSelectedEvent } from "@/hooks/use-event-config";
import Link from "next/link";

export default function Page() {
  const selectedEvent = useSelectedEvent();

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Overview</span>
                </Button>
              </Link>
              <div className="h-6 w-px bg-border"></div>
              <h1 className="text-lg font-semibold dark:text-white">
                Match Scouting
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ModeToggle />
              <ThemeSelector />
            </div>
          </div>
          {/* Year selector on second row for mobile */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-3">
              {selectedEvent && (
                <Badge
                  variant="outline"
                  className="max-w-[14rem] truncate text-xs"
                  title={selectedEvent.name}
                >
                  {selectedEvent.name}
                </Badge>
              )}
            </div>
            <OfflineStatusWidget />
          </div>
        </div>
      </div>

      {!selectedEvent ? (
        <div className="mx-auto max-w-2xl px-4 py-12">
          <Card className="border-dashed text-center">
            <CardHeader>
              <CardTitle>Select an event before scouting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Match entries must be attached to an event so schedules and teams can be filled correctly.
              </p>
              <Button asChild>
                <Link href="/dashboard">Choose an event</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="max-w-4xl mx-auto px-4 py-6 text-center">
              Loading...
            </div>
          }
        >
          <DynamicMatchScoutForm />
        </Suspense>
      )}
    </div>
  );
}
