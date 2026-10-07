"use client";

import { ConfigurableTeamPage } from "@/components/team-pages/configurable-team-page";

interface TeamPageClientProps {
  teamNumber: string;
}

export default function TeamPageClient({ teamNumber }: TeamPageClientProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header with Year Selector */}
      <div className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{teamNumber} Team Analysis</h1>
        </div>
      </div>

      <div className="px-3">
        <ConfigurableTeamPage teamNumber={teamNumber} />
      </div>
    </div>
  );
}
