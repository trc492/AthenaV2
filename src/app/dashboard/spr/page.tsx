"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Target,
  Users,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Loader2,
  Award,
  Star,
  TriangleAlert,
  CircleHelp,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSelectedEvent } from "@/hooks/use-event-config";
import { useSPRData, type ScouterSPR } from "@/hooks/use-spr-data";
import { get } from "http";

function getPerformanceBadge(percentile: number) {
  if (percentile >= 75) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <Star className="h-3 w-3 mr-1" />
        Top 25%
      </Badge>
    );
  }
  if (percentile >= 50) {
    return <Badge variant="secondary">Above Avg</Badge>;
  }
  if (percentile >= 25) {
    return <Badge variant="outline">Below Avg</Badge>;
  }
  return (
    <Badge variant="destructive">
      <TriangleAlert className="h-3 w-3 mr-1" />
      Needs Help
    </Badge>
  );
}

function getDisplayName(scouter: ScouterSPR) {
  return scouter.scouterName || "Unknown Scouter";
}

function MetricTooltip({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[320px] leading-relaxed">
        <p className="font-semibold">{title}</p>
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function SPRPage() {
  const [verbose, setVerbose] = useState(false);
  const selectedEvent = useSelectedEvent();
  const { data, loading, error, refetch } = useSPRData({ verbose });

  if (!selectedEvent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Scouter Performance
          </h1>
          <p className="text-muted-foreground">
            Select an event to view scouter performance ratings.
          </p>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No event selected. Please select an event from the sidebar to see
            SPR data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Scouter Performance
          </h1>
          <p className="text-muted-foreground">
            Scouter Performance Rating (SPR) — accuracy analysis for{" "}
            {selectedEvent.name}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="spr-verbose"
              checked={verbose}
              onCheckedChange={setVerbose}
              disabled={loading}
            />
            <Label
              htmlFor="spr-verbose"
              className="text-xs text-muted-foreground sm:text-sm"
            >
              Verbose (show by-match breakdown)
            </Label>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !data && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">
              Calculating scouter performance ratings...
            </span>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Data Display */}
      {data && (
        <>
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="gap-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 -pb-1">
                <CardTitle className="text-sm font-medium">
                  Mean Error
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.overallMeanError.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  points per alliance
                </p>
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 -pb-1">
                <CardTitle className="text-sm font-medium">Scouters</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.metadata.uniqueScouters}
                </div>
                <p className="text-xs text-muted-foreground">
                  active scouters analyzed
                </p>
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 -pb-1">
                <CardTitle className="text-sm font-medium">
                  Match Entries
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.metadata.totalMatches}
                </div>
                <p className="text-xs text-muted-foreground">
                  scouted entries with IDs
                </p>
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 -pb-1">
                <CardTitle className="text-sm font-medium">
                  Official Results
                </CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.metadata.officialResultsCount}
                </div>
                <p className="text-xs text-muted-foreground">
                  matches with official scores
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Warning Message */}
          {data.message && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{data.message}</AlertDescription>
            </Alert>
          )}

          {/* Scouter Rankings Table */}
          <Card>
            <CardHeader>
              <CardTitle>Scouter Rankings</CardTitle>
              <CardDescription>
                Ranked by error contribution — lower error value means more
                accurate scouting. SPR uses a least-squares method similar to
                OPR to isolate each scouter's accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent className="">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Scouter</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Error Value
                        <MetricTooltip
                          title="Error Value"
                          description="Estimated per-alliance error contribution from the least-squares model. Lower is better."
                        />
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Matches</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center justify-end gap-1">
                        Total Error
                        <MetricTooltip
                          title="Total Error"
                          description="Cumulative absolute alliance error share attributed to this scouter. Larger values can reflect either lower accuracy, more matches, or both."
                        />
                      </span>
                    </TableHead>
                    <TableHead className="text-center">
                      <span className="inline-flex items-center justify-center gap-1">
                        Accuracy
                        <MetricTooltip
                          title="Accuracy (Percentile)"
                          description="Relative rank among scouters after sorting by Error Value. 100 is best in this event, 0 is lowest."
                        />
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.scouters.map((scouter, index) => (
                    <TableRow key={scouter.scouterId} className="">
                      <TableCell className="font-medium my-1">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium my-1">
                           {getDisplayName(scouter)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono my-1">
                        {scouter.errorValue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right my-1">
                        {scouter.matchesScounted}
                      </TableCell>
                      <TableCell className="text-right font-mono my-1">
                        {scouter.totalAbsoluteError.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-center my-1">
                        {getPerformanceBadge(scouter.percentile)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data.scouters.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No scouter data available. Make sure match entries have
                  scouter IDs assigned.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scouter Detail Cards */}
          {data.scouters.length >= 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Best Performer */}
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="-mb-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-green-500" />
                    Best Performer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {getDisplayName(data.scouters[0])}
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>
                      Error Value:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {data.scouters[0].errorValue.toFixed(2)}
                      </span>
                    </p>
                    <p>
                      Matches Scouted:{" "}
                      <span className="font-medium text-foreground">
                        {data.scouters[0].matchesScounted}
                      </span>
                    </p>
                    <p>
                      Total Absolute Error:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {data.scouters[0].totalAbsoluteError.toFixed(1)}
                      </span>
                    </p>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Accuracy (Percentile)</span>
                      <span>{data.scouters[0].percentile}th percentile</span>
                    </div>
                    <Progress
                      value={data.scouters[0].percentile}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Needs Improvement */}
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader className="-mb-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-orange-500" />
                    Needs Improvement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {getDisplayName(data.scouters[data.scouters.length - 1])}
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>
                      Error Value:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {data.scouters[
                          data.scouters.length - 1
                        ].errorValue.toFixed(2)}
                      </span>
                    </p>
                    <p>
                      Matches Scouted:{" "}
                      <span className="font-medium text-foreground">
                        {
                          data.scouters[data.scouters.length - 1]
                            .matchesScounted
                        }
                      </span>
                    </p>
                    <p>
                      Total Absolute Error:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {data.scouters[
                          data.scouters.length - 1
                        ].totalAbsoluteError.toFixed(1)}
                      </span>
                    </p>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Accuracy (Percentile)</span>
                      <span>
                        {data.scouters[data.scouters.length - 1].percentile}th
                        percentile
                      </span>
                    </div>
                    <Progress
                      value={data.scouters[data.scouters.length - 1].percentile}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Verbose By-Match Breakdown */}
          {verbose && data.verboseData && (
            <Card>
              <CardHeader>
                <CardTitle>By-Match Breakdown</CardTitle>
                <CardDescription>
                  Detailed alliance-level equations used in SPR calculation.
                  Used: {data.verboseData.usedEquations} | Skipped:{" "}
                  {data.verboseData.skippedEquations} | Total:{" "}
                  {data.verboseData.totalEquations}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Match</TableHead>
                        <TableHead>Alliance</TableHead>
                        <TableHead>Scouters</TableHead>
                        <TableHead className="text-right">Scouted</TableHead>
                        <TableHead className="text-right">Official</TableHead>
                        <TableHead className="text-right">Fouls</TableHead>
                        <TableHead className="text-right">Adjusted</TableHead>
                        <TableHead className="text-right">Error</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.verboseData.equations.map((equation, index) => (
                        <TableRow
                          key={`${equation.matchNumber}-${equation.alliance}-${index}`}
                        >
                          <TableCell className="font-mono">
                            Q{equation.matchNumber}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                equation.alliance === "red"
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {equation.alliance}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate">
                            {equation.scouterNames?.join(", ") ||
                              "Unknown Scouter"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {equation.scoutedTotal}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {equation.officialScore}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {equation.foulPoints}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {equation.adjustedOfficial}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {equation.error}
                          </TableCell>
                          <TableCell>
                            {equation.skipped ? (
                              <Badge variant="outline">
                                Skipped
                                {equation.skipReason
                                  ? `: ${equation.skipReason}`
                                  : ""}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Used</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Methodology */}
          <Card>
            <CardHeader>
              <CardTitle>Methodology</CardTitle>
              <CardDescription>
                SPR models each alliance as one equation and solves a
                least-squares system, similar to OPR. For each alliance: scouted
                points (without penalties) are compared to official score
                adjusted for opponent foul points. Lower values are better
                because they represent less estimated error contribution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                1. Build equations per alliance using assigned scouters and
                observed alliance error.
              </p>
              <p>
                2. Solve for each scouter's error contribution using
                ridge-regularized normal equations.
              </p>
              <p>
                3. Rank scouters by Error Value (ascending), then convert rank
                into Accuracy percentile.
              </p>
              <p>
                4. Total Error is cumulative and grows with match count, so
                compare it alongside Matches.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
