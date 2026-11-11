/**
 * Game Config Loader
 *
 * This module dynamically loads and assembles game configurations from individual year files.
 * Each year's configuration is stored in a separate JSON file under config/years/
 * for better organization and maintainability.
 */

import FRC2026 from "./years/FRC-2026.json";
import FRC2025 from "./years/FRC-2025.json";
import FTC2027 from "./years/FTC-2027.json";
import FTC2026 from "./years/FTC-2026.json";
import { GameConfig, YearConfig } from "@/lib/types";
/**
 * Assembled game configuration object
 * Maintains the same structure as the original monolithic game-config.json
 */
const gameConfig: GameConfig = {
  FRC: {
    2026: FRC2026 as YearConfig,
    2025: FRC2025 as YearConfig,
  },
  FTC: {
    2027: FTC2027 as YearConfig,
    2026: FTC2026 as YearConfig,
  },
};

export default gameConfig;
