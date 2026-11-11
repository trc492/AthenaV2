type Bounds = { left: number; right: number; top: number; bottom: number };

/** Fit beside the target, using space above/below on narrow screens. */
export function positionTour(target: Bounds, viewportWidth: number, viewportHeight: number, contentHeight: number) {
  const margin = 12;
  const gap = 14;
  const width = Math.min(320, viewportWidth - margin * 2);
  let maxHeight = viewportHeight - margin * 2;
  const height = Math.min(contentHeight, maxHeight);
  let side: "right" | "left" | "top" | "bottom";
  let left: number;
  let top: number;
  if (target.right + gap + width <= viewportWidth - margin) {
    side = "right"; left = target.right + gap; top = target.top;
  } else if (target.left - gap - width >= margin) {
    side = "left"; left = target.left - gap - width; top = target.top;
  } else {
    const above = Math.max(0, target.top - gap - margin);
    const below = Math.max(0, viewportHeight - target.bottom - gap - margin);
    side = below >= height || below >= above ? "bottom" : "top";
    maxHeight = Math.max(64, side === "bottom" ? below : above);
    left = target.left;
    top = side === "bottom" ? target.bottom + gap : target.top - gap - Math.min(height, maxHeight);
  }
  return {
    side, width, maxHeight,
    left: Math.max(margin, Math.min(left, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(top, viewportHeight - Math.min(contentHeight, maxHeight) - margin)),
  };
}
