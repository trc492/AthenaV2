# Year Configuration Files

This directory contains individual game configuration files for each competition year. Each file defines the complete game rules, scoring, and pit scouting configuration for a specific competition type and year.

## Directory Structure

```
config/
├── years/
│   ├── FRC-2026.json    # FRC 2026 REBUILT game config
│   ├── FRC-2025.json    # FRC 2025 REEFSCAPE game config
│   ├── FTC-2026.json    # FTC 2026 DECODE game config
│   └── README.md        # This file
└── game-config-loader.ts # Assembles all year configs
```

## File Naming Convention

Year config files follow this pattern: `{COMPETITION_TYPE}-{YEAR}.json`

Examples:

- `FRC-2026.json` - FRC competition for 2026 season
- `FTC-2025.json` - FTC competition for 2025 season

## Adding a New Year Configuration

### Step 1: Create the Year Config File

Create a new JSON file in `config/years/` following the naming convention:

```bash
config/years/FRC-2027.json
```

### Step 2: Define the Configuration

Use this template structure:

```json
{
  "competitionType": "FRC",
  "gameName": "GAME NAME HERE",
  "startPositions": ["Position 1", "Position 2", "Position 3"],
  "scoring": {
    "autonomous": {
      "field_name": {
        "label": "Display Label",
        "points": 5,
        "description": "What this field tracks",
        "type": "number",
        "increments": [1, 5, 10]
      }
    },
    "teleop": {},
    "endgame": {},
    "fouls": {}
  },
  "pitScouting": {
    "autonomous": {},
    "teleoperated": {},
    "endgame": {}
  },
  "matchupCardConfig": {
    "autoIcon": "Flame",
    "autoMetrics": [],
    "teleopIcon": "Flame",
    "teleopMetrics": [],
    "endgame": { "states": [] }
  },
  "teamPageConfig": {
    "kpis": { "auto": {}, "teleop": {} },
    "autoPerformance": { "metrics": [] },
    "teleopPerformance": { "metrics": [] },
    "scoringBreakdownChart": { "items": [] },
    "endgame": { "states": [] },
    "penalties": {}
  }
}
```

**Field Types:**

- `number` - Numeric counter (default)
- `boolean` - Yes/No toggle
- `select` - Dropdown with predefined options (use `pointValues`)

**Optional Properties:**

- `increments: [1, 5, 10]` - Shows quick increment buttons for number fields
- `pointValues: {"option1": 5, "option2": 10}` - For select fields with variable scoring

### Step 3: Register in the Loader

Update `config/game-config-loader.ts`:

```typescript
import FRC2027Raw from "./years/FRC-2027.json";

const gameConfig: GameConfig = {
  FRC: {
    2027: FRC2027Raw as YearConfig,
    2026: FRC2026Raw as YearConfig,
    2025: FRC2025Raw as YearConfig,
  },
  FTC: {
    2026: FTC2026Raw as YearConfig,
  },
};
```

### Step 4: Validate

Run the build to validate your configuration:

```bash
pnpm build
```

## Benefits of Split Configuration

✅ **Better Organization** - Each year is self-contained and easier to navigate
✅ **Version Control** - Cleaner git diffs when updating a single year
✅ **Maintainability** - Add new years without modifying existing configs
✅ **Modularity** - Easy to copy/modify configs from previous years
✅ **Clarity** - Smaller, focused files are easier to understand

## Legacy Support

The `game-config-loader.ts` assembles all year configs into the same structure as the original monolithic `game-config.json`, so existing code continues to work without changes.

## Documentation

For more details on game configuration options, see:

- [YEAR_CONFIG_README.md](../YEAR_CONFIG_README.md) - Complete configuration guide
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) - Development patterns
