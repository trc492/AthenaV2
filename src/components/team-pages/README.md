# Team Pages Directory

This directory contains the universal JSON-configurable team analysis page component and backwards-compatible export wrappers.

## JSON-Driven Configuration Architecture

Team pages are now fully configuration-driven. When you add or update a year configuration JSON in `config/years/` (such as `FRC-2026.json`), the team analysis page automatically adapts its:
- Key performance indicators (Auto / Teleop KPIs, sub-rates)
- Autonomous & Teleop performance breakdown tables and point estimates
- Scoring breakdown charts with custom palettes
- Endgame distributions (cards or charts)
- Reliability and penalty calculations
- Custom game-specific sections (e.g. playstyle, patterns)
- Pit scouting capabilities and robot dimension summaries
- Autonomous field path drawing

## Main Components

- `configurable-team-page.tsx` - The universal, responsive, JSON-driven team page component.
- `frc-team-2025-page.tsx` - Backwards-compatible wrapper for FRC 2025.
- `frc-team-2026-page.tsx` - Backwards-compatible wrapper for FRC 2026.
- `ftc-team-2026-page.tsx` - Backwards-compatible wrapper for FTC 2026.

## How to Configure a Year

Add a `teamPageConfig` object to your year config in `config/years/{COMPETITION_TYPE}-{YEAR}.json`:

```json
{
  "competitionType": "FRC",
  "gameName": "REBUILT",
  "scoring": { ... },
  "pitScouting": { ... },
  "teamPageConfig": {
    "kpis": {
      "auto": {
        "key": "autonomous.fuel_scored",
        "label": "Avg Fuel (Auto)",
        "subKey": "autonomous.climb",
        "subLabel": "Climb rate",
        "subFormat": "percent",
        "icon": "Activity"
      },
      "teleop": {
        "key": "teleop.fuel_scored",
        "label": "Avg Fuel Scored",
        "subKey": "teleop.fuel_accuracy",
        "subLabel": "Accuracy",
        "subFormat": "percent",
        "icon": "Flame"
      }
    },
    "autoPerformance": {
      "metrics": [
        { "key": "autonomous.fuel_scored", "label": "Avg Fuel Scored" }
      ],
      "showPointsEstimate": true
    },
    "teleopPerformance": { ... },
    "scoringBreakdownChart": { ... },
    "endgame": { ... },
    "penalties": { ... }
  }
}
```
