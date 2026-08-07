import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { evaluateMapViewport } from "./useHexMapViewport.js";
import { axialToPixel } from "./useHexGeometry.js";
import { useHexMapCamera } from "./useHexMapCamera.js";

const hexes = [
  { id: "origin", q: 0, r: 0, terrain: "forest" },
  { id: "east", q: 1, r: 0, terrain: "forest" },
  { id: "west", q: -1, r: 0, terrain: "forest" },
];

describe("evaluateMapViewport with player camera", () => {
  it("centers framing on focusPoint when provided", () => {
    const focus = axialToPixel(1, 0, 44);
    const result = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: "origin",
      discovered: ["origin", "east"],
      mode: "gameplay",
      size: 44,
      focusPoint: focus,
    });
    const cx = result.viewBox.x + result.viewBox.width / 2;
    const cy = result.viewBox.y + result.viewBox.height / 2;
    expect(cx).toBeCloseTo(focus.x, 5);
    expect(cy).toBeCloseTo(focus.y, 5);
  });

  it("uses cameraViewBox for culling when zoomed out", () => {
    const tight = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: "origin",
      discovered: ["origin", "east", "west"],
      mode: "gameplay",
      size: 44,
    });
    const wide = evaluateMapViewport({
      allHexes: hexes,
      currentHexId: "origin",
      discovered: ["origin", "east", "west"],
      mode: "gameplay",
      size: 44,
      cameraViewBox: {
        x: tight.viewBox.x - 200,
        y: tight.viewBox.y - 200,
        width: tight.viewBox.width + 400,
        height: tight.viewBox.height + 400,
      },
    });
    expect(wide.visibleHexes.length).toBeGreaterThanOrEqual(tight.visibleHexes.length);
    expect(wide.viewBox.width).toBe(tight.viewBox.width + 400);
  });
});

describe("useHexMapCamera", () => {
  it("zooms while preserving cursor-anchored world point roughly at center default", () => {
    const focus = ref({ x: 0, y: 0 });
    const enabled = ref(true);
    const cam = useHexMapCamera({
      mapSvgRef: ref(null),
      focusPoint: focus,
      size: ref(44),
      panelAspect: ref(1.5),
      enabled,
    });
    const before = { ...cam.viewBoxObject.value };
    cam.zoomBy(0.5);
    const after = cam.viewBoxObject.value;
    expect(after.width).toBeLessThan(before.width);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height);
    // Default anchor 0.5,0.5 → center should stay on focus
    expect(after.x + after.width / 2).toBeCloseTo(0, 5);
    expect(after.y + after.height / 2).toBeCloseTo(0, 5);
  });

  it("recenters on focus change while preserving zoom", async () => {
    const focus = ref({ x: 0, y: 0 });
    const cam = useHexMapCamera({
      mapSvgRef: ref(null),
      focusPoint: focus,
      size: ref(44),
      panelAspect: ref(1),
      enabled: ref(true),
    });
    cam.zoomBy(0.5);
    const zoomedWidth = cam.viewBoxObject.value.width;
    focus.value = { x: 120, y: -40 };
    await nextTick();
    const box = cam.viewBoxObject.value;
    expect(box.width).toBeCloseTo(zoomedWidth);
    expect(box.x + box.width / 2).toBeCloseTo(120, 5);
    expect(box.y + box.height / 2).toBeCloseTo(-40, 5);
  });

  it("does nothing when disabled (builder / override path)", () => {
    const focus = ref({ x: 0, y: 0 });
    const cam = useHexMapCamera({
      mapSvgRef: ref(null),
      focusPoint: focus,
      size: ref(44),
      panelAspect: ref(1),
      enabled: ref(false),
    });
    const before = cam.viewBoxString.value;
    cam.zoomBy(0.5);
    expect(cam.viewBoxString.value).toBe(before);
  });
});
