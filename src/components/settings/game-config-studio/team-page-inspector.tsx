"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatapointPicker } from "./datapoint-picker";
import { buildDatapointRegistry } from "@/lib/game-config/datapoint-registry";
import type { TeamPageConfig, YearConfig } from "@/lib/types";

function TextField({ label, value, onChange }: {
  label: string; value?: string; onChange: (value: string) => void;
}) {
  return <label className="block space-y-1 text-xs">{label}
    <Input aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  </label>;
}

function NumberField({ label, value, onChange }: {
  label: string; value?: number; onChange: (value: number | undefined) => void;
}) {
  return <label className="block space-y-1 text-xs">{label}
    <Input aria-label={label} type="number" step="any" value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
  </label>;
}

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly T[]; onChange: (value: T) => void;
}) {
  return <div className="space-y-1 text-xs">
    <span>{label}</span>
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as T)}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>;
}

export function TeamPageInspector({ section, config, value, onChange }: {
  section: "kpi" | "autoPerformance" | "teleopPerformance" | "chart" | "endgame" | "penalties";
  config: YearConfig;
  value: TeamPageConfig;
  onChange: (patch: Partial<TeamPageConfig>) => void;
}) {
  const datapoints = buildDatapointRegistry(config).filter((d) => !d.pitSection);
  const numeric = datapoints.filter((d) => d.valueType === "number" || d.valueType === "boolean");
  const field = (label: string, key: string | undefined, change: (key: string) => void, enums = false) => (
    <div className="space-y-1">
      <span className="text-xs">{label}</span>
      <DatapointPicker value={key} onChange={change}
        datapoints={enums ? datapoints.filter((d) => d.valueType === "enum") : numeric} />
    </div>
  );
  const remove = (label: string, action: () => void) => (
    <Button type="button" variant="destructive" size="sm" onClick={action}>{label}</Button>
  );

  if (section === "kpi") {
    return <div className="space-y-5">{(["auto", "teleop"] as const).map((phase) => {
      const kpi = value.kpis[phase];
      const update = (patch: Partial<typeof kpi>) => onChange({
        kpis: { ...value.kpis, [phase]: { ...kpi, ...patch } },
      });
      return <div key={phase} className="space-y-3">
        <p className="text-sm font-semibold">{phase === "auto" ? "Autonomous KPI" : "Teleop KPI"}</p>
        <TextField label="Label" value={kpi.label} onChange={(label) => update({ label })} />
        {field("Field", kpi.key, (key) => update({ key }))}
        <Choice label="Primary format" value={kpi.format ?? "number"} options={["number", "percent"]}
          onChange={(format) => update({ format })} />
        {field("Secondary field", kpi.subKey, (subKey) => update({ subKey }))}
        {kpi.subKey && remove("Remove secondary field", () => update({ subKey: undefined }))}
        <TextField label="Secondary label" value={kpi.subLabel} onChange={(subLabel) => update({ subLabel })} />
        <Choice label="Secondary format" value={kpi.subFormat ?? "number"} options={["number", "percent"]}
          onChange={(subFormat) => update({ subFormat })} />
        <Choice label="Icon" value={kpi.icon ?? "Activity"}
          options={["Activity", "Target", "Trophy", "Flame", "Package", "Puzzle", "BarChart", "Sparkles"]}
          onChange={(icon) => update({ icon })} />
      </div>;
    })}</div>;
  }

  if (section === "autoPerformance" || section === "teleopPerformance") {
    const performance = value[section];
    const update = (patch: Partial<typeof performance>) => onChange({ [section]: { ...performance, ...patch } });
    return <div className="space-y-4">
      {performance.metrics.map((metric, index) => {
        const edit = (patch: Partial<typeof metric>) => update({
          metrics: performance.metrics.map((item, i) => i === index ? { ...item, ...patch } : item),
        });
        return <div key={index} className="space-y-2 rounded-md border p-2">
          <TextField label="Metric label" value={metric.label} onChange={(label) => edit({ label })} />
          {field("Metric field", metric.key, (key) => edit({ key }))}
          <Choice label="Display" value={metric.type ?? "number"} options={["number", "rate", "badge"]}
            onChange={(type) => edit({ type })} />
          <TextField label="Unit" value={metric.unit} onChange={(unit) => edit({ unit })} />
          {remove("Remove metric", () => update({ metrics: performance.metrics.filter((_, i) => i !== index) }))}
        </div>;
      })}
      <Button type="button" variant="outline" onClick={() => update({
        metrics: [...performance.metrics, { key: numeric[0]?.key ?? "", label: numeric[0]?.label ?? "New metric" }],
      })}>Add metric</Button>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={!!performance.showPointsEstimate}
          onChange={(e) => update({ showPointsEstimate: e.target.checked })} />Show points estimate
      </label>
      <p className="text-xs text-muted-foreground">Without a custom formula, estimates use the scouting field points.</p>
      {(performance.pointsFormula ?? []).map((term, index) => (
        <div key={index} className="space-y-2 rounded-md border p-2">
          {field("Points field", term.key, (key) => update({
            pointsFormula: performance.pointsFormula?.map((item, i) => i === index ? { ...item, key } : item),
          }))}
          <NumberField label="Points multiplier" value={term.points} onChange={(points) => update({
            pointsFormula: performance.pointsFormula?.map((item, i) => i === index ? { ...item, points: points ?? 0 } : item),
          })} />
          {remove("Remove formula term", () => {
            const terms = performance.pointsFormula?.filter((_, i) => i !== index);
            update({ pointsFormula: terms?.length ? terms : undefined });
          })}
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => update({
        pointsFormula: [...(performance.pointsFormula ?? []), { key: numeric[0]?.key ?? "", points: 1 }],
      })}>Add formula term</Button>
    </div>;
  }

  if (section === "chart") {
    const chart = value.scoringBreakdownChart;
    const update = (patch: Partial<typeof chart>) => onChange({ scoringBreakdownChart: { ...chart, ...patch } });
    return <div className="space-y-3">
      <TextField label="Chart title" value={chart.title} onChange={(title) => update({ title })} />
      <TextField label="Chart description" value={chart.description} onChange={(description) => update({ description })} />
      <TextField label="Chart unit" value={chart.unit} onChange={(unit) => update({ unit })} />
      {chart.items.map((item, index) => {
        const edit = (patch: Partial<typeof item>) => update({
          items: chart.items.map((entry, i) => i === index ? { ...entry, ...patch } : entry),
        });
        return <div key={index} className="space-y-2 rounded-md border p-2">
          <TextField label="Item name" value={item.name} onChange={(name) => edit({ name })} />
          {field("Item field", item.key, (key) => edit({ key }))}
          <TextField label="Color" value={item.fill} onChange={(fill) => edit({ fill })} />
          {remove("Remove chart item", () => update({ items: chart.items.filter((_, i) => i !== index) }))}
        </div>;
      })}
    </div>;
  }

  if (section === "endgame") {
    const endgame = value.endgame;
    const update = (patch: Partial<typeof endgame>) => onChange({ endgame: { ...endgame, ...patch } });
    return <div className="space-y-3">
      <TextField label="Endgame title" value={endgame.title} onChange={(title) => update({ title })} />
      <TextField label="Endgame description" value={endgame.description} onChange={(description) => update({ description })} />
      <Choice label="Endgame display" value={endgame.displayType ?? "cards"} options={["cards", "chart", "both"]}
        onChange={(displayType) => update({ displayType })} />
      <TextField label="Summary title" value={endgame.summaryTitle} onChange={(summaryTitle) => update({ summaryTitle })} />
      <TextField label="Summary description" value={endgame.summaryDescription} onChange={(summaryDescription) => update({ summaryDescription })} />
      {field("Robot state field", endgame.stateKey, (stateKey) => {
        const selected = datapoints.find((d) => d.key === stateKey);
        const [phase, key] = stateKey.split(".");
        const definition = config.scoring[phase as keyof typeof config.scoring]?.[key];
        update({ stateKey, states: (selected?.states ?? []).map((state) => ({
          value: state, label: state, points: definition?.pointValues?.[state],
        })) });
      }, true)}
      {field("Breakdown field", endgame.breakdownKey, (breakdownKey) => update({ breakdownKey }))}
      {endgame.breakdownKey && remove("Remove breakdown field", () => update({ breakdownKey: undefined }))}
      {endgame.states.map((state, index) => {
        const edit = (patch: Partial<typeof state>) => update({
          states: endgame.states.map((item, i) => i === index ? { ...item, ...patch } : item),
        });
        return <div key={index} className="space-y-2 rounded-md border p-2">
          <TextField label="State value" value={state.value} onChange={(value) => edit({ value })} />
          <TextField label="State label" value={state.label} onChange={(label) => edit({ label })} />
          <NumberField label="State points" value={state.points} onChange={(points) => edit({ points })} />
          <NumberField label="Highlight threshold (%)" value={state.highlightThreshold} onChange={(highlightThreshold) => edit({ highlightThreshold })} />
          <TextField label="State color" value={state.fill} onChange={(fill) => edit({ fill })} />
          {remove("Remove state", () => update({ states: endgame.states.filter((_, i) => i !== index) }))}
        </div>;
      })}
      <Button type="button" variant="outline" onClick={() => update({
        states: [...endgame.states, { value: "", label: "New state" }],
      })}>Add state</Button>
    </div>;
  }

  const penalties = value.penalties;
  const update = (patch: Partial<typeof penalties>) => onChange({ penalties: { ...penalties, ...patch } });
  return <div className="space-y-3">
    <TextField label="Penalties title" value={penalties.title} onChange={(title) => update({ title })} />
    <TextField label="Penalties description" value={penalties.description} onChange={(description) => update({ description })} />
    {(["minor", "major"] as const).map((kind) => <div key={kind} className="space-y-2">
      {field(`${kind} foul field`, penalties[`${kind}Key`], (key) => update({ [`${kind}Key`]: key }))}
      <TextField label={`${kind} foul label`} value={penalties[`${kind}Label`]}
        onChange={(label) => update({ [`${kind}Label`]: label })} />
      <NumberField label={`${kind} foul points`} value={penalties[`${kind}Points`]}
        onChange={(points) => update({ [`${kind}Points`]: points ?? 0 })} />
    </div>)}
    <NumberField label="Tech foul alert threshold" value={penalties.techFoulAlertThreshold}
      onChange={(techFoulAlertThreshold) => update({ techFoulAlertThreshold })} />
    <NumberField label="Breakdown alert threshold (%)" value={penalties.breakdownAlertThreshold}
      onChange={(breakdownAlertThreshold) => update({ breakdownAlertThreshold })} />
  </div>;
}
