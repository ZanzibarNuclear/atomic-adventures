import { describe, expect, it } from "vitest";
import {
  focusedViewBox,
  panViewBoxByPixels,
  recenterViewBoxOnFocus,
  zoomViewBoxAt,
} from "./useGridMapTransform.js";

describe("focusedViewBox", () => {
  it("centers a gameplay frame on the focus point", () => {
    const focus = { x: 100, y: 200 };
    const box = focusedViewBox(focus, 2, 50, 4);
    // height = cell * spanCells = 200, width = height * aspect = 400
    expect(box.w).toBeCloseTo(400);
    expect(box.h).toBeCloseTo(200);
    expect(box.x + box.w / 2).toBeCloseTo(100);
    expect(box.y + box.h / 2).toBeCloseTo(200);
  });
});

describe("zoomViewBoxAt", () => {
  it("zooms around an anchor without drifting the anchor point", () => {
    const before = { x: 0, y: 0, w: 100, h: 50 };
    const after = zoomViewBoxAt(before, 0.5, 0.25, 0.5);
    // Anchor world point before: (25, 25)
    const ax = before.x + before.w * 0.25;
    const ay = before.y + before.h * 0.5;
    expect(after.w).toBeCloseTo(50);
    expect(after.h).toBeCloseTo(25);
    expect(after.x + after.w * 0.25).toBeCloseTo(ax);
    expect(after.y + after.h * 0.5).toBeCloseTo(ay);
  });

  it("respects min/max width limits", () => {
    const before = { x: 0, y: 0, w: 100, h: 100 };
    const tooSmall = zoomViewBoxAt(before, 0.01, 0.5, 0.5, {
      minWidth: 40,
      maxWidth: 200,
    });
    expect(tooSmall.w).toBe(40);
    const tooLarge = zoomViewBoxAt(before, 10, 0.5, 0.5, {
      minWidth: 40,
      maxWidth: 200,
    });
    expect(tooLarge.w).toBe(200);
  });
});

describe("panViewBoxByPixels", () => {
  it("translates the viewBox by screen-pixel deltas", () => {
    const before = { x: 10, y: 20, w: 100, h: 50 };
    const after = panViewBoxByPixels(before, 50, 25, 200, 100);
    // dx 50 / 200 * w 100 = 25 world units left in x (viewBox.x decreases when dragging right)
    expect(after.x).toBeCloseTo(10 - 25);
    expect(after.y).toBeCloseTo(20 - 12.5);
    expect(after.w).toBe(100);
    expect(after.h).toBe(50);
  });
});

describe("recenterViewBoxOnFocus", () => {
  it("keeps zoom size and centers the frame on the focus", () => {
    const zoomed = { x: 0, y: 0, w: 80, h: 40 };
    const next = recenterViewBoxOnFocus(zoomed, { x: 300, y: 150 });
    expect(next.w).toBe(80);
    expect(next.h).toBe(40);
    expect(next.x + next.w / 2).toBeCloseTo(300);
    expect(next.y + next.h / 2).toBeCloseTo(150);
  });

  it("is a no-op for invalid focus", () => {
    const zoomed = { x: 1, y: 2, w: 80, h: 40 };
    expect(recenterViewBoxOnFocus(zoomed, null)).toBe(zoomed);
    expect(recenterViewBoxOnFocus(zoomed, { x: NaN, y: 0 })).toBe(zoomed);
  });
});
