import { describe, expect, it } from "vitest";
import { positionTour } from "@/lib/onboarding-position";

describe("floating tour placement", () => {
  it("sits to the right of desktop sidebar controls", () => {
    const tip = positionTour({ left: 16, right: 240, top: 650, bottom: 700 }, 1280, 800, 280);
    expect(tip.side).toBe("right");
    expect(tip.left).toBeGreaterThan(240);
    expect(tip.top + 280).toBeLessThanOrEqual(788);
  });
  it("sits above a mobile profile menu without covering its choices", () => {
    const tip = positionTour({ left: 12, right: 280, top: 520, bottom: 780 }, 390, 844, 280);
    expect(tip.side).toBe("top");
    expect(tip.top + 280).toBeLessThan(520);
    expect(tip.left + tip.width).toBeLessThanOrEqual(378);
  });
  it("fits below a mobile event menu and scrolls tall tip contents", () => {
    const tip = positionTour({ left: 12, right: 280, top: 40, bottom: 260 }, 320, 568, 400);
    expect(tip.side).toBe("bottom");
    expect(tip.top).toBeGreaterThan(260);
    expect(tip.top + tip.maxHeight).toBeLessThanOrEqual(556);
  });
  it("flips left for a control near the right edge", () => {
    const tip = positionTour({ left: 1000, right: 1200, top: 40, bottom: 90 }, 1280, 800, 280);
    expect(tip.side).toBe("left");
    expect(tip.left + tip.width).toBeLessThan(1000);
  });
});
