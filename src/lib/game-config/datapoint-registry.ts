import type { YearConfig } from "@/lib/types/game/config";
import { getFieldType } from "@/components/forms/match-form-utils";

export type DatapointValueType = "number" | "boolean" | "enum" | "text";

export interface Datapoint {
  /** Fully-qualified reference key, e.g. "teleop.L4_coral" */
  key: string;
  label: string;
  group: string;
  valueType: DatapointValueType;
  /** Possible values, for enum datapoints */
  states?: string[];
  /** Set for pit-scouting entries, which are referenced by section + field */
  pitSection?: "autonomous" | "teleoperated" | "endgame" | "driveTeam";
}

const SCORING_SECTIONS = [
  ["autonomous", "Autonomous"],
  ["teleop", "Teleop"],
  ["endgame", "Endgame"],
  ["fouls", "Fouls"],
] as const;

const PIT_SECTIONS = [
  ["autonomous", "Pit: Autonomous"],
  ["teleoperated", "Pit: Teleoperated"],
  ["endgame", "Pit: Endgame"],
  ["driveTeam", "Pit: Drive Team"],
] as const;

/**
 * Every key that can be referenced from a matchup card, team page, or insight
 * rule, derived from the config being edited rather than a fixed list.
 */
export function buildDatapointRegistry(config: YearConfig): Datapoint[] {
  const datapoints: Datapoint[] = [];

  for (const [section, groupLabel] of SCORING_SECTIONS) {
    const fields = config.scoring?.[section];
    if (!fields) continue;

    for (const [fieldKey, definition] of Object.entries(fields)) {
      // Same inference the real scouting form uses, so the picker can never
      // disagree with what actually gets recorded.
      const fieldType = getFieldType(definition);
      const states =
        fieldType === "select" && definition.pointValues
          ? Object.keys(definition.pointValues)
          : undefined;

      datapoints.push({
        key: `${section}.${fieldKey}`,
        label: definition.label || fieldKey,
        group: groupLabel,
        valueType:
          fieldType === "select"
            ? "enum"
            : fieldType === "boolean"
              ? "boolean"
              : "number",
        states,
      });
    }
  }

  for (const metric of config.derivedMetrics || []) {
    datapoints.push({
      key: metric.key,
      label: metric.label || metric.key,
      group: "Derived",
      valueType: "number",
    });
  }

  datapoints.push({
    key: "epa",
    label: "EPA (Expected Points Added)",
    group: "Derived",
    valueType: "number",
  });

  for (const [section, groupLabel] of PIT_SECTIONS) {
    const fields = config.pitScouting?.[section];
    if (!fields) continue;

    for (const [fieldKey, definition] of Object.entries(fields)) {
      datapoints.push({
        key: fieldKey,
        label: definition.label || fieldKey,
        group: groupLabel,
        valueType:
          definition.type === "boolean"
            ? "boolean"
            : definition.type === "number"
              ? "number"
              : definition.type === "text"
                ? "text"
                : "enum",
        states: definition.options,
        pitSection: section,
      });
    }
  }

  return datapoints;
}

/**
 * Rate keys for a single enum state, e.g. "endgame.ending_robot_state.deep".
 * Referenced by endgame state lists rather than by metric pickers.
 */
export function buildStateDatapoints(config: YearConfig): Datapoint[] {
  return buildDatapointRegistry(config)
    .filter((d) => d.valueType === "enum" && !d.pitSection && d.states)
    .flatMap((d) =>
      d.states!.map((state) => ({
        key: `${d.key}.${state}`,
        label: `${d.label} = ${state}`,
        group: d.group,
        valueType: "number" as const,
      })),
    );
}

export function findDatapoint(
  registry: Datapoint[],
  key: string | undefined,
): Datapoint | undefined {
  if (!key) return undefined;
  const exact = registry.find((d) => d.key === key);
  if (exact) return exact;
  // Consumers sometimes store the bare field name without its section prefix
  const short = key.split(".").pop();
  return registry.find((d) => d.key.split(".").pop() === short);
}
