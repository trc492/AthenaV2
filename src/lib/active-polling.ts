/** Refresh only while an online, visible tab has recent user activity. */
export function startActivePolling(
  refresh: () => void,
  intervalMs: number,
  idleMs = 5 * 60_000,
): () => void {
  let lastActivity = Date.now();
  let lastRefresh = Date.now();

  const poll = () => {
    const now = Date.now();
    if (
      document.visibilityState !== "visible" ||
      !navigator.onLine ||
      now - lastActivity >= idleMs ||
      now - lastRefresh < intervalMs
    ) return;
    lastRefresh = now;
    refresh();
  };
  const activity = () => {
    if (document.visibilityState !== "visible") return;
    lastActivity = Date.now();
    poll();
  };
  const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "focus", "online"];
  for (const event of activityEvents) window.addEventListener(event, activity, { passive: true });
  document.addEventListener("visibilitychange", activity);
  const timer = window.setInterval(poll, intervalMs);
  return () => {
    window.clearInterval(timer);
    for (const event of activityEvents) window.removeEventListener(event, activity);
    document.removeEventListener("visibilitychange", activity);
  };
}
