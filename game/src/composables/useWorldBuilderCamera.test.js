import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { expandToAspect, useWorldBuilderCamera } from "./useWorldBuilderCamera.js";

describe("useWorldBuilderCamera", () => {
  it("expands frames to the requested aspect ratio", () => {
    expect(expandToAspect({ x: 0, y: 0, width: 100, height: 100 }, 2)).toEqual({
      x: -50,
      y: 0,
      width: 200,
      height: 100,
    });
    expect(expandToAspect({ x: 0, y: 0, width: 200, height: 100 }, 1)).toEqual({
      x: 0,
      y: -50,
      width: 200,
      height: 200,
    });
  });

  it("focuses camera around a point and reports view box strings", () => {
    const camera = useWorldBuilderCamera();
    camera.fitFrame.value = { x: 0, y: 0, width: 1000, height: 500 };
    camera.camera.value = { x: 0, y: 0, width: 1000, height: 500 };
    camera.focusPoint({ x: 50, y: 80 });
    expect(camera.camera.value).toEqual({ x: -160, y: -25, width: 420, height: 210 });
    expect(camera.viewBoxString.value).toBe("-160 -25 420 210");
  });

  it("fits maps using ref-backed world arrays and numeric size", () => {
    const camera = useWorldBuilderCamera();
    camera.fitMap({
      hexes: ref([
        { id: "origin", q: 0, r: 0 },
        { id: "ridge", q: 1, r: 0 },
      ]),
      routes: ref([{ id: "route", points: [] }]),
      features: ref([{ id: "river", points: [] }]),
      size: ref(44),
    });

    expect(camera.viewBoxString.value).not.toContain("NaN");
    expect(camera.camera.value.width).toBeCloseTo(221.57, 2);
    expect(camera.camera.value.width).toBeGreaterThan(0);
    expect(camera.camera.value.height).toBeGreaterThan(0);
  });
});
