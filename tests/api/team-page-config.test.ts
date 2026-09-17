import { describe, expect, it } from "vitest";
import frc2026 from "../../config/years/FRC-2026.json";
import frc2025 from "../../config/years/FRC-2025.json";
import ftc2026 from "../../config/years/FTC-2026.json";
import { buildTeamPageDefaults } from "@/lib/game-config/team-page-defaults";
import { buildPreviewTeamData } from "@/lib/game-config/preview-stats";
import { calculateDetailedGameStats } from "@/lib/statistics";
import { validateYearConfig } from "@/lib/server/config-validator";
import type { YearConfig } from "@/lib/types";

describe("team page studio configuration", () => {
  for (const source of [frc2026, frc2025, ftc2026]) {
    const config = source as YearConfig;
    it(`resolves all bundled references for ${config.competitionType} ${config.gameName}`, () => {
      expect(validateYearConfig(config).warnings).toEqual([]);
    });
    it(`builds game-specific defaults and preview stats for ${config.gameName}`, () => {
      const draft = { ...config, teamPageConfig: buildTeamPageDefaults(config) };
      expect(validateYearConfig(draft).warnings).toEqual([]);
      const team = buildPreviewTeamData(draft);
      const stats = calculateDetailedGameStats(team.matchEntries, draft, team);
      expect(stats).not.toBeNull();
      expect(stats?.getMetricValue(draft.teamPageConfig.kpis.auto.key)).toBeGreaterThan(0);
      draft.teamPageConfig.autoPerformance.pointsFormula = [{ key: draft.teamPageConfig.kpis.auto.key, points: 7 }];
      const updated = calculateDetailedGameStats(team.matchEntries, draft, team);
      expect(updated?.points.autoEstimatedPoints).not.toEqual(stats?.points.autoEstimatedPoints);
    });
  }
});
