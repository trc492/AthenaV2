// Utility functions for match scouting form

import type { DynamicMatchData } from "@/lib/types";

// CSS to hide number input spinners
export const hideSpinnersStyle = `
  .hide-spinners::-webkit-outer-spin-button,
  .hide-spinners::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  .hide-spinners[type=number] {
    -moz-appearance: textfield;
  }
`;

export const defaultData: DynamicMatchData = {
  matchNumber: 0,
  teamNumber: 0,
  alliance: "red",
  alliancePosition: 1,
  autonomous: {},
  teleop: {},
  endgame: {},
  fouls: {},
  notes: "",
};

// Helper function to create combined alliance position value
export const getCombinedAlliancePosition = (
  alliance: "red" | "blue",
  position: number,
): string => {
  return `${alliance}-${position}`;
};

// Helper function to parse combined alliance position value
export const parseCombinedAlliancePosition = (
  combined: string,
): { alliance: "red" | "blue"; position: number } => {
  const [alliance, position] = combined.split("-");
  return {
    alliance: alliance as "red" | "blue",
    position: parseInt(position, 10),
  };
};

/** Encode a start position label the way the scouting form persists it. */
export const encodeStartPosition = (label: string): string =>
  label.toLowerCase().replace(/\s+/g, "-");

// Function to initialize form data with all game config fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const initializeFormData = (gameConfig: any): DynamicMatchData => {
  const data: DynamicMatchData = { ...defaultData };

  if (!gameConfig?.scoring) return data;

  // Initialize autonomous fields
  if (gameConfig.scoring.autonomous) {
    Object.keys(gameConfig.scoring.autonomous).forEach((key) => {
      const fieldConfig = gameConfig.scoring.autonomous[key];
      if (fieldConfig.type === "boolean") {
        data.autonomous[key] = false;
      } else if (
        fieldConfig.type === "number" ||
        fieldConfig.points !== undefined
      ) {
        data.autonomous[key] = 0;
      } else if (fieldConfig.pointValues) {
        const options = Object.keys(fieldConfig.pointValues);
        data.autonomous[key] = options.length > 0 ? options[0] : "";
      } else {
        data.autonomous[key] = 0;
      }
    });
  }

  // Add startPosition field for autonomous with first configured position as default
  const defaultPosition =
    gameConfig.startPositions && gameConfig.startPositions.length > 0
      ? encodeStartPosition(gameConfig.startPositions[0])
      : "center";
  data.autonomous.startPosition = defaultPosition;

  // Initialize teleop fields
  if (gameConfig.scoring.teleop) {
    Object.keys(gameConfig.scoring.teleop).forEach((key) => {
      const fieldConfig = gameConfig.scoring.teleop[key];
      if (fieldConfig.type === "boolean") {
        data.teleop[key] = false;
      } else if (
        fieldConfig.type === "number" ||
        fieldConfig.points !== undefined
      ) {
        data.teleop[key] = 0;
      } else if (fieldConfig.pointValues) {
        const options = Object.keys(fieldConfig.pointValues);
        data.teleop[key] = options.length > 0 ? options[0] : "";
      } else {
        data.teleop[key] = 0;
      }
    });
  }

  // Initialize endgame fields
  if (gameConfig.scoring.endgame) {
    Object.keys(gameConfig.scoring.endgame).forEach((key) => {
      const fieldConfig = gameConfig.scoring.endgame[key];
      if (fieldConfig.type === "boolean") {
        data.endgame[key] = false;
      } else if (
        fieldConfig.type === "number" ||
        fieldConfig.points !== undefined
      ) {
        data.endgame[key] = 0;
      } else if (fieldConfig.pointValues) {
        const options = Object.keys(fieldConfig.pointValues);
        data.endgame[key] = options.length > 0 ? options[0] : "";
      } else {
        data.endgame[key] = 0;
      }
    });
  }

  // Initialize fouls fields
  if (gameConfig.scoring.fouls) {
    Object.keys(gameConfig.scoring.fouls).forEach((key) => {
      const fieldConfig = gameConfig.scoring.fouls[key];
      if (fieldConfig.type === "boolean") {
        data.fouls[key] = false;
      } else if (
        fieldConfig.type === "number" ||
        fieldConfig.points !== undefined
      ) {
        data.fouls[key] = 0;
      } else if (fieldConfig.pointValues) {
        const options = Object.keys(fieldConfig.pointValues);
        data.fouls[key] = options.length > 0 ? options[0] : "";
      } else {
        data.fouls[key] = 0;
      }
    });
  }

  return data;
};

// --- Persistent last-submitted match per event ---

const LAST_MATCH_KEY_PREFIX = "athena-last-match";

/** Build a localStorage key scoped to the event. */
const lastMatchKey = (eventCode: string) =>
  `${LAST_MATCH_KEY_PREFIX}-${eventCode}`;

/** Read the last submitted match number for the given event (0 if none). */
export const getLastSubmittedMatch = (eventCode: string): number => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(lastMatchKey(eventCode));
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

/** Persist the last submitted match number for the given event. */
export const setLastSubmittedMatch = (
  eventCode: string,
  matchNumber: number,
): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(lastMatchKey(eventCode), String(matchNumber));
  } catch {
    // localStorage full or unavailable – silently ignore
  }
};

// Determine field type based on configuration structure
export const getFieldType = (fieldConfig: any) => {
  // First check if type is explicitly defined
  if (fieldConfig.type) {
    return fieldConfig.type;
  }

  // Fall back to inference based on structure
  if (fieldConfig.pointValues && typeof fieldConfig.pointValues === "object") {
    return "select";
  }
  if (
    fieldConfig.points !== undefined &&
    typeof fieldConfig.points === "number"
  ) {
    // Check if this is typically a boolean field based on label
    const label = fieldConfig.label.toLowerCase();
    if (
      label.includes("mobility") ||
      label.includes("park") ||
      label.includes("climb") ||
      label.includes("dock") ||
      label.includes("engage") ||
      label.includes("harmony") ||
      label.includes("barge")
    ) {
      return "boolean";
    }
    return "number";
  }
  return "number";
};
