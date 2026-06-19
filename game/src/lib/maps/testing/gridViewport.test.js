import { describe, expect, it } from "vitest";
import { expandFrameToAspect } from "../composables/useGridMapTransform.js";

const frame = {
  minX: 0,
  maxX: 400,
  minY: 0,
  maxY: 200,
  bcx: 200,
  bcy: 100,
};

describe("grid map viewport contract", () => {
  it("preserves the canonical gameplay center while adapting to panel aspect", () => {
    const wide = expandFrameToAspect(frame, 16 / 9);
    const tall = expandFrameToAspect(frame, 3 / 4);

    expect(wide.bcx).toBe(200);
    expect(wide.bcy).toBe(100);
    expect(tall.bcx).toBe(200);
    expect(tall.bcy).toBe(100);
    expect(wide.w / wide.h).toBeCloseTo(16 / 9);
    expect(tall.w / tall.h).toBeCloseTo(3 / 4);
  });

  it("uses fit-all as a zoomed-out version of the same gameplay frame", () => {
    const gameplay = expandFrameToAspect(frame, 16 / 9, 1);
    const fitAll = expandFrameToAspect(frame, 16 / 9, 0.82);

    expect(fitAll.bcx).toBe(gameplay.bcx);
    expect(fitAll.bcy).toBe(gameplay.bcy);
    expect(fitAll.w).toBeGreaterThan(gameplay.w);
    expect(fitAll.h).toBeGreaterThan(gameplay.h);
  });
});
