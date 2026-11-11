export const GAME_CONFIG_UPDATED = "athena:game-config-updated";

/** Refresh this tab and notify other tabs after a successful server write. */
export function notifyGameConfigUpdated() {
  window.dispatchEvent(new Event(GAME_CONFIG_UPDATED));
  try {
    localStorage.setItem(GAME_CONFIG_UPDATED, crypto.randomUUID());
  } catch {
    // Focus and periodic refresh still work when storage is unavailable.
  }
}
