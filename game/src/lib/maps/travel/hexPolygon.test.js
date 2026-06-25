import { describe, expect, it } from "vitest";
import { axialToPixel } from "../composables/useHexGeometry.js";
import { hexPolygon, pointInHexPolygon, segmentInsideHex } from "./hexPolygon.js";

const interpolate = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

describe("hex polygon helpers", () => {
  it("builds corners around an axial hex center", () => {
    const hex = { q: 1, r: -1 };
    const size = 44;
    const center = axialToPixel(hex.q, hex.r, size);
    const corners = hexPolygon(hex, size);
    expect(corners).toHaveLength(6);
    expect(Math.hypot(corners[0].x - center.x, corners[0].y - center.y)).toBeCloseTo(size);
  });

  it("detects points inside and outside a hex polygon", () => {
    const hex = { q: 0, r: 0 };
    const size = 44;
    expect(pointInHexPolygon({ x: 0, y: 0 }, hex, size)).toBe(true);
    expect(pointInHexPolygon({ x: 200, y: 200 }, hex, size)).toBe(false);
  });

  it("samples whether a segment stays inside a hex", () => {
    const hex = { q: 0, r: 0 };
    const size = 44;
    expect(segmentInsideHex({ x: -5, y: 0 }, { x: 5, y: 0 }, hex, size, interpolate)).toBe(true);
    expect(segmentInsideHex({ x: -5, y: 0 }, { x: 100, y: 0 }, hex, size, interpolate)).toBe(false);
  });
});
