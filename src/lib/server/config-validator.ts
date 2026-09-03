import type { YearConfig, ScoringDefinition } from "@/lib/types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates whether an object adheres to the YearConfig interface specifications.
 */
export function validateYearConfig(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      valid: false,
      errors: ["Configuration root must be a non-null object."],
      warnings: [],
    };
  }

  const config = data as Partial<YearConfig>;

  // 1. Competition Type
  if (!config.competitionType) {
    errors.push("Missing 'competitionType'. Must be 'FRC' or 'FTC'.");
  } else if (config.competitionType !== "FRC" && config.competitionType !== "FTC") {
    errors.push(
      `Invalid 'competitionType': '${config.competitionType}'. Must be 'FRC' or 'FTC'.`,
    );
  }

  // 2. Game Name
  if (!config.gameName || typeof config.gameName !== "string" || !config.gameName.trim()) {
    errors.push("Missing or invalid 'gameName'. Must be a non-empty string.");
  }

  // 3. Start Positions (optional but if present must be array of strings)
  if (config.startPositions !== undefined) {
    if (!Array.isArray(config.startPositions)) {
      errors.push("'startPositions' must be an array of strings.");
    } else {
      config.startPositions.forEach((pos, idx) => {
        if (typeof pos !== "string" || !pos.trim()) {
          errors.push(`'startPositions[${idx}]' must be a non-empty string.`);
        }
      });
    }
  }

  // 4. Scoring Configuration
  if (!config.scoring || typeof config.scoring !== "object") {
    errors.push("Missing 'scoring' object.");
  } else {
    const scoringSections = ["autonomous", "teleop", "endgame"] as const;
    scoringSections.forEach((section) => {
      const secData = config.scoring?.[section];
      if (!secData || typeof secData !== "object" || Array.isArray(secData)) {
        errors.push(`'scoring.${section}' must be an object.`);
      } else {
        Object.entries(secData).forEach(([key, def]) => {
          validateScoringDefinition(`scoring.${section}.${key}`, def, errors, warnings);
        });
      }
    });

    if (config.scoring.fouls !== undefined) {
      if (typeof config.scoring.fouls !== "object" || Array.isArray(config.scoring.fouls)) {
        errors.push("'scoring.fouls' must be an object if provided.");
      } else {
        Object.entries(config.scoring.fouls).forEach(([key, def]) => {
          validateScoringDefinition(`scoring.fouls.${key}`, def, errors, warnings);
        });
      }
    }
  }

  // 5. Pit Scouting Configuration
  if (!config.pitScouting || typeof config.pitScouting !== "object") {
    errors.push("Missing 'pitScouting' object.");
  } else {
    const pitSections = ["autonomous", "teleoperated", "driveTeam", "endgame"] as const;
    pitSections.forEach((section) => {
      const secData = config.pitScouting?.[section];
      if (secData !== undefined) {
        if (typeof secData !== "object" || Array.isArray(secData)) {
          errors.push(`'pitScouting.${section}' must be an object.`);
        } else {
          Object.entries(secData).forEach(([key, field]) => {
            validatePitScoutField(`pitScouting.${section}.${key}`, field, errors, warnings);
          });
        }
      }
    });
  }

  // 6. Analysis Insights (optional)
  if (config.analysisInsights !== undefined) {
    if (
      typeof config.analysisInsights !== "object" ||
      !Array.isArray(config.analysisInsights.insights)
    ) {
      warnings.push("'analysisInsights.insights' should be an array of insight definitions.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateScoringDefinition(
  path: string,
  def: unknown,
  errors: string[],
  warnings: string[],
) {
  if (!def || typeof def !== "object") {
    errors.push(`${path} must be an object definition.`);
    return;
  }

  const item = def as Partial<ScoringDefinition>;
  if (!item.label || typeof item.label !== "string") {
    errors.push(`${path} is missing a required 'label' string.`);
  }

  if (item.type && !["boolean", "select", "number"].includes(item.type)) {
    errors.push(
      `${path}.type has invalid value '${item.type}'. Allowed: 'boolean' | 'select' | 'number'.`,
    );
  }

  if (item.increments !== undefined) {
    if (!Array.isArray(item.increments) || !item.increments.every((n) => typeof n === "number")) {
      errors.push(`${path}.increments must be an array of numbers.`);
    }
  }

  if (item.pointValues !== undefined) {
    if (typeof item.pointValues !== "object" || Array.isArray(item.pointValues)) {
      errors.push(`${path}.pointValues must be a key-value object of string to number.`);
    }
  }
}

function validatePitScoutField(
  path: string,
  field: unknown,
  errors: string[],
  warnings: string[],
) {
  if (!field || typeof field !== "object") {
    errors.push(`${path} must be an object definition.`);
    return;
  }

  const item = field as {
    label?: string;
    type?: string;
    options?: unknown;
    dependsOn?: string;
  };

  if (!item.label || typeof item.label !== "string") {
    errors.push(`${path} is missing a required 'label' string.`);
  }

  const validTypes = ["text", "number", "boolean", "select", "multiselect"];
  if (!item.type || !validTypes.includes(item.type)) {
    errors.push(
      `${path}.type has invalid value '${item.type}'. Allowed: ${validTypes.join(", ")}.`,
    );
  }

  if (item.type === "select" || item.type === "multiselect") {
    if (!Array.isArray(item.options) || item.options.length === 0) {
      warnings.push(`${path} is type '${item.type}' but has no options configured.`);
    }
  }
}
