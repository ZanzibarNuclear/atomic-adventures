import { describe, expect, it } from "vitest";
import { segmentIntersection, segmentsCross, sideOfLine } from "./segments.js";

describe("segment geometry", () => {
  it("detects strict segment crossings", () => {
    expect(segmentsCross(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    )).toBe(true);
    expect(segmentsCross(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    )).toBe(false);
  });

  it("returns intersection points and path parameter", () => {
    expect(segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
    )).toEqual({ x: 5, y: 0, t: 0.5 });
    expect(segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 1 },
      { x: 10, y: 1 },
    )).toBeNull();
  });

  it("reports signed side of a line", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(sideOfLine({ x: 5, y: 2 }, a, b)).toBeGreaterThan(0);
    expect(sideOfLine({ x: 5, y: -2 }, a, b)).toBeLessThan(0);
    expect(sideOfLine({ x: 5, y: 0 }, a, b)).toBe(0);
  });
});
