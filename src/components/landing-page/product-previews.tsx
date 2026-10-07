"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Award, BarChart3, Calendar, ChevronDown, ChevronRight, ClipboardList, Database, LayoutDashboard, MapPin, PanelLeft, RadioTower, Search, Settings, Sun, Table2, Target, Users, Wifi, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MatchInfoSection } from "@/components/forms/match-info-section";
import { defaultData } from "@/components/forms/match-form-utils";
import { ScoringField } from "@/components/forms/scoring-field";
import gameConfig from "../../../config/years/FRC-2026.json";

// Presentation-only excerpts of the real screens. No session, API, or offline
// providers are mounted, and inert keeps sample controls out of the tab order.
function PreviewFrame({ title, children, width = 760, height = 580 }: {
  title: string;
  children: ReactNode;
  width?: number;
  height?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return (
    <figure className="m-0 min-w-0">
      <div ref={frame} role="img" aria-label={`${title}. Illustrative sample data.`} className="relative overflow-hidden rounded-xl border bg-card text-card-foreground" style={{ aspectRatio: `${width} / ${height}` }}>
        <div inert aria-hidden="true" className="absolute left-0 top-0 origin-top-left overflow-hidden bg-background text-foreground" style={{ width, height, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
          {children}
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">{title} · Sample data</figcaption>
    </figure>
  );
}

function SampleSelect({ value, className = "" }: { value: string; className?: string }) {
  return (
    <Select value={value}>
      <SelectTrigger className={`w-full ${className}`}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value={value}>{value}</SelectItem></SelectContent>
    </Select>
  );
}

function PreviewTabs({ labels, selected }: { labels: string[]; selected: string }) {
  return <Tabs value={selected}><TabsList className="grid h-11 w-full" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>{labels.map(label => <TabsTrigger key={label} value={label}>{label}</TabsTrigger>)}</TabsList></Tabs>;
}

function SidebarPreview() {
  return (
    <aside className="flex w-48 shrink-0 flex-col rounded-lg border bg-sidebar text-sidebar-foreground">
      <div className="rounded-t-lg bg-blue-200 px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-900 dark:bg-blue-900 dark:text-slate-100">FIRST Robotics Competition</div>
      <div className="space-y-3 p-2">
        <div className="flex items-center gap-2 rounded-md border p-2"><MapPin className="size-4" /><div className="flex-1"><p className="text-xs font-semibold">Demo Regional</p><p className="text-[10px] text-muted-foreground">2026 · FRC</p></div><ChevronDown className="size-3" /></div>
        <div className="flex items-center gap-2 rounded-md border px-2 py-2 text-xs text-muted-foreground"><Search className="size-3" />Search...</div>
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent p-2 text-xs font-medium"><LayoutDashboard className="size-4" />Overview</div>
        {[{ icon: RadioTower, label: "Competition", items: ["Schedule", "Start Pit Scouting", "Start Match Scouting", "Match Preview"] }, { icon: Database, label: "Data", items: ["Teams", "Pit Entries", "Match Entries", "Scouter Performance"] }, { icon: BarChart3, label: "Strategy", items: ["Analysis", "Picklist"] }].map(({ icon: Icon, label, items }) => <div key={label}><div className="flex items-center gap-2 p-2 text-xs font-medium"><Icon className="size-4" />{label}<ChevronDown className="ml-auto size-3" /></div><div className="ml-4 space-y-2 border-l px-4 py-1 text-xs text-muted-foreground">{items.map(item => <div key={item}>{item}</div>)}</div></div>)}
        <div className="flex items-center gap-2 p-2 text-xs"><Settings className="size-4" />Settings</div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t p-3"><div className="flex size-7 items-center justify-center rounded-lg bg-muted text-xs">AS</div><div className="text-xs font-semibold">Alex Scout<p className="font-normal text-muted-foreground">@alex</p></div></div>
    </aside>
  );
}

export function DashboardPreview() {
  return (
    <PreviewFrame title="Overview — Live operations" width={1040} height={720}>
      <div className="flex h-full gap-2 bg-sidebar p-2">
        <SidebarPreview />
        <div className="min-w-0 flex-1 rounded-lg border bg-background">
          <div className="flex h-14 items-center border-b px-4"><PanelLeft className="size-4" /><Sun className="ml-auto size-4" /></div>
          <div className="space-y-6 p-5">
            <div className="flex justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-3xl font-bold tracking-tight">Overview</h2><Badge>Live workspace</Badge></div><p className="mt-1 text-muted-foreground">Your operational view for Demo Regional.</p></div><Badge variant="outline" className="h-8 gap-1.5"><Wifi className="size-3.5" />Online</Badge></div>
            <div className="w-[360px]"><PreviewTabs labels={["Live operations", "Review event"]} selected="Live operations" /></div>
            <Card className="border border-primary/30 bg-primary/[0.035]">
              <CardHeader><div className="flex justify-between"><div><CardDescription className="font-semibold uppercase tracking-wide text-primary">Next assignment</CardDescription><CardTitle className="mt-1 text-2xl">Match 43</CardTitle></div><Badge className="h-fit bg-red-600 text-white">Red 1</Badge></div></CardHeader>
              <CardContent className="space-y-5"><p className="text-sm text-muted-foreground">Your match, alliance, position, and team will be filled from the event schedule.</p><div className="flex gap-3"><Button className="h-11"><ClipboardList />Start assigned match</Button><Button variant="outline" className="h-11"><Users />Start pit scouting</Button><Button variant="ghost" className="h-11">View schedule</Button></div></CardContent>
            </Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-5" />Coverage</CardTitle><CardDescription>Current scouting completion</CardDescription></CardHeader><CardContent className="space-y-5">{[{ label: "Pit scouting", current: 36, total: 42 }, { label: "Qualification matches", current: 42, total: 78 }].map(row => <div key={row.label} className="space-y-2"><div className="flex justify-between text-sm"><span>{row.label}</span><span className="text-muted-foreground">{row.current} / {row.total}</span></div><Progress value={row.current / row.total * 100} /></div>)}</CardContent></Card>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

export function SchedulePreview() {
  return (
    <PreviewFrame title="Schedule — Match Assignments" height={610}>
      <div className="space-y-5 p-6">
        <h2 className="text-3xl font-bold tracking-tight">Schedule</h2>
        <Card><CardHeader><div className="flex items-center gap-2"><CardTitle className="flex items-center gap-2"><Users className="size-5" />Active Scouts</CardTitle><Badge variant="secondary">6 selected</Badge><ChevronRight className="ml-auto size-5" /></div><CardDescription>Used for auto-assign and group template actions.</CardDescription></CardHeader></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Calendar className="size-5" />Match Assignments</CardTitle><Badge>8 virtual groups</Badge></div><CardDescription>All matches are visible below. Use virtual group templates for fast range edits.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-4 font-medium">Virtual Group Templates<ChevronRight className="size-4" /></div>
          {[43, 44].map(match => <div key={match} className="space-y-3 rounded-md border px-3 py-2"><p className="text-sm font-medium">Match {match}</p><div className="grid grid-cols-2 gap-4">{["Red", "Blue"].map((alliance, side) => <div key={alliance} className="space-y-2"><p className={`text-xs font-medium ${side ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>{alliance}</p><div className="grid grid-cols-3 gap-2">{(side ? ["Kai", "Lee", "Max"] : ["Alex", "Sam", "Jo"]).map((name, index) => <div key={name} className="space-y-1"><p className="text-xs text-muted-foreground">{alliance} {index + 1}</p><SampleSelect value={name} /></div>)}</div></div>)}</div></div>)}
        </CardContent></Card>
      </div>
    </PreviewFrame>
  );
}

export function PitPreview() {
  return (
    <PreviewFrame title="REBUILT — Pit Scouting" height={650}>
      <div className="space-y-6 px-6 py-6">
        <div className="text-center"><Badge variant="outline" className="px-4 py-2 text-lg">{gameConfig.gameName} - Pit Scouting</Badge></div>
        <Card className="shadow-sm"><CardContent className="space-y-6 pt-6">
          <div className="border-b pb-4"><h2 className="mb-4 text-xl font-semibold">Team Information</h2><div className="w-1/2 space-y-2"><p className="text-base font-medium">Team Number</p><SampleSelect value="Team 492" className="h-12 text-base" /></div></div>
          <div className="border-b pb-4"><h3 className="mb-4 text-lg font-semibold">Robot Information</h3><div className="grid grid-cols-2 gap-6"><div className="space-y-2"><p className="text-base font-medium">Drivetrain</p><SampleSelect value="Swerve" className="h-12 text-base" /></div>{[{ label: "Length (inches)", value: "30" }, { label: "Width (inches)", value: "28" }, { label: "Weight (lbs)", value: "115" }].map(field => <div key={field.label} className="space-y-2"><p className="text-base font-medium">{field.label}</p><Input readOnly value={field.value} className="h-12 text-base" /></div>)}</div></div>
          <div className="flex items-center gap-4"><Switch checked aria-label="Has Autonomous Capabilities" /><span className="text-base font-medium">Has Autonomous Capabilities</span></div>
          <h3 className="text-lg font-semibold">Autonomous Capabilities</h3>
        </CardContent></Card>
      </div>
    </PreviewFrame>
  );
}

const noop = () => {};
export function MatchPreview() {
  return (
    <PreviewFrame title="REBUILT — Match Scouting" height={650}>
      <div className="space-y-5 p-6">
        <div className="text-center"><Badge variant="outline" className="px-4 py-2 text-lg">{gameConfig.gameName} - Match Scouting</Badge></div>
        <MatchInfoSection
          formData={{ ...defaultData, matchNumber: 43, teamNumber: 492, alliance: "red", alliancePosition: 1 }}
          competitionType="FRC"
          eventTeamNumbers={[254, 1678, 118, 492]}
          teamsLoading={false}
          onBasicInputChange={noop}
          onAllianceChange={noop}
        />
        <Tabs value="teleop"><TabsList className="grid h-12 w-full grid-cols-3"><TabsTrigger value="auto"><Zap className="size-4" />Auto</TabsTrigger><TabsTrigger value="teleop"><Award className="size-4" />Teleop</TabsTrigger><TabsTrigger value="endgame">Endgame</TabsTrigger></TabsList></Tabs>
        <Card className="rounded-xl border shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-primary/90"><Award className="size-5" />Teleop Period</CardTitle><CardDescription>Driver-controlled period performance</CardDescription></CardHeader><CardContent className="space-y-6">
          <ScoringField section="teleop" fieldKey="fuel_scored" fieldConfig={gameConfig.scoring.teleop.fuel_scored} currentValue={45} onValueChange={noop} onNumberChange={noop} />
          <ScoringField section="teleop" fieldKey="fuel_missed" fieldConfig={gameConfig.scoring.teleop.fuel_missed} currentValue={5} onValueChange={noop} onNumberChange={noop} />
        </CardContent></Card>
      </div>
    </PreviewFrame>
  );
}

const epaTeams = [
  { team: "254", auto: 22, teleop: 45, endgame: 20 },
  { team: "1678", auto: 18, teleop: 42, endgame: 20 },
  { team: "118", auto: 20, teleop: 35, endgame: 15 },
  { team: "2056", auto: 16, teleop: 32, endgame: 15 },
  { team: "492", auto: 15, teleop: 30, endgame: 10 },
];
export function AnalyticsPreview() {
  return (
    <PreviewFrame title="Analysis — EPA Graph" height={630}>
      <div className="space-y-5 p-6">
        <h2 className="text-3xl font-bold tracking-tight">Analysis</h2>
        <Card><CardHeader><CardTitle>EPA Analysis</CardTitle><CardDescription>Switch between chart and table views to explore team performance data</CardDescription></CardHeader><CardContent className="space-y-6">
          <Tabs value="chart"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="chart"><BarChart3 className="size-4" />Chart View</TabsTrigger><TabsTrigger value="table"><Table2 className="size-4" />Table View</TabsTrigger></TabsList></Tabs>
          <Card><CardHeader><div className="flex justify-between"><div><CardTitle>EPA Graph</CardTitle><CardDescription>Click legend items to toggle categories</CardDescription></div><div className="flex"><Button variant="secondary" size="sm">Stacked</Button><Button variant="ghost" size="sm">Box &amp; Whisker</Button></div></div></CardHeader><CardContent>
            <svg viewBox="0 0 640 285" className="w-full" aria-hidden="true">
              {[0, 25, 50, 75, 100].map(value => <g key={value}><line x1="38" x2="630" y1={245 - value * 2.1} y2={245 - value * 2.1} stroke="var(--border)" strokeDasharray="3 3" /><text x="27" y={249 - value * 2.1} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">{value}</text></g>)}
              {epaTeams.map((team, i) => <g key={team.team}><rect x={65 + i * 112} y={245 - team.endgame * 2.1} width="62" height={team.endgame * 2.1} fill="var(--chart-2)" /><rect x={65 + i * 112} y={245 - (team.endgame + team.teleop) * 2.1} width="62" height={team.teleop * 2.1} fill="var(--chart-3)" /><rect x={65 + i * 112} y={245 - (team.endgame + team.teleop + team.auto) * 2.1} width="62" height={team.auto * 2.1} fill="var(--chart-4)" /><text x={96 + i * 112} y="267" textAnchor="middle" fill="var(--muted-foreground)" fontSize="12">{team.team}</text></g>)}
            </svg>
            <div className="flex justify-center gap-5 text-xs">{[{ label: "Penalties", color: "var(--chart-1)" }, { label: "Endgame", color: "var(--chart-2)" }, { label: "Teleop", color: "var(--chart-3)" }, { label: "Auto", color: "var(--chart-4)" }].map(item => <span key={item.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: item.color }} />{item.label}</span>)}</div>
          </CardContent></Card>
        </CardContent></Card>
      </div>
    </PreviewFrame>
  );
}
