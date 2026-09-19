import { describe, it, expect } from "vitest";
import { computeCutoutRect, computeTooltipPosition } from "./spotlightPosition.js";

const viewport = { width: 400, height: 800 };
const tooltipSize = { width: 280, height: 160 };

function rect({ top, left, width, height }) {
  return { top, left, width, height, right: left + width, bottom: top + height };
}

describe("computeCutoutRect", () => {
  it("pads the target rect on every side", () => {
    const cutout = computeCutoutRect(rect({ top: 100, left: 50, width: 120, height: 40 }), 6);
    expect(cutout).toEqual({ top: 94, left: 44, width: 132, height: 52 });
  });
});

describe("computeTooltipPosition", () => {
  it("places the tooltip below the target when there's room", () => {
    const target = rect({ top: 100, left: 100, width: 120, height: 40 });
    const { top } = computeTooltipPosition(target, viewport, tooltipSize);
    expect(top).toBe(target.bottom + 12);
  });

  it("places the tooltip above the target when there's no room below", () => {
    const target = rect({ top: 700, left: 100, width: 120, height: 40 });
    const { top } = computeTooltipPosition(target, viewport, tooltipSize);
    expect(top).toBe(target.top - 12 - tooltipSize.height);
  });

  it("centers the tooltip horizontally on the target", () => {
    const target = rect({ top: 100, left: 100, width: 120, height: 40 });
    const { left } = computeTooltipPosition(target, viewport, tooltipSize);
    const expectedCenter = target.left + target.width / 2 - tooltipSize.width / 2;
    expect(left).toBe(expectedCenter);
  });

  it("clamps left so the tooltip never overflows the left edge", () => {
    const target = rect({ top: 100, left: 0, width: 20, height: 40 });
    const { left } = computeTooltipPosition(target, viewport, tooltipSize);
    expect(left).toBe(8);
  });

  it("clamps left so the tooltip never overflows the right edge", () => {
    const target = rect({ top: 100, left: 390, width: 10, height: 40 });
    const { left } = computeTooltipPosition(target, viewport, tooltipSize);
    expect(left).toBe(viewport.width - tooltipSize.width - 8);
  });

  it("clamps top to the viewport margin when the target is near the very top with no room above or below", () => {
    const target = rect({ top: 0, left: 100, width: 120, height: 780 });
    const { top } = computeTooltipPosition(target, viewport, tooltipSize);
    expect(top).toBe(8);
  });
});
