import { describe, expect, it } from "vitest";
import { planKnownHexPath } from "../composables/knownAreaOutdoorTravel.js";
import { axialToPixel } from "../composables/useHexGeometry.js";

const SIZE = 44;

/** Synthetic axial chain A—B—C (eastward). No barriers. */
function chainWorld() {
  const hexes = [
    { id: "a", q: 0, r: 0 },
    { id: "b", q: 1, r: 0 },
    { id: "c", q: 2, r: 0 },
  ];
  const hexById = Object.fromEntries(hexes.map((h) => [h.id, h]));
  const hexAtPoint = (point, prefer) => {
    let best = prefer && hexById[prefer] ? prefer : null;
    let bestD = Infinity;
    for (const h of hexes) {
      const c = axialToPixel(h.q, h.r, SIZE);
      const d = Math.hypot(point.x - c.x, point.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = h.id;
      }
    }
    return best;
  };
  return {
    hexById,
    hexAtPoint,
    size: SIZE,
    travelCtx: { barriers: [], openings: [] },
    routeModels: [],
  };
}

describe("planKnownHexPath", () => {
  it("returns empty steps when already at the target", () => {
    const world = chainWorld();
    const stand = axialToPixel(0, 0, SIZE);
    const plan = planKnownHexPath({
      fromHexId: "a",
      fromStand: stand,
      toHexId: "a",
      discovered: ["a", "b", "c"],
      ...world,
    });
    expect(plan).not.toBeNull();
    expect(plan.steps).toEqual([]);
  });

  it("plans multi-hop through discovered hexes only", () => {
    const world = chainWorld();
    const stand = axialToPixel(0, 0, SIZE);
    const plan = planKnownHexPath({
      fromHexId: "a",
      fromStand: stand,
      toHexId: "c",
      discovered: ["a", "b", "c"],
      ...world,
    });
    expect(plan).not.toBeNull();
    expect(plan.steps.map((s) => s.hexId)).toEqual(["b", "c"]);
  });

  it("refuses multi-hop into fog", () => {
    const world = chainWorld();
    const stand = axialToPixel(0, 0, SIZE);
    const plan = planKnownHexPath({
      fromHexId: "a",
      fromStand: stand,
      toHexId: "c",
      discovered: ["a", "b"], // c fogged
      ...world,
    });
    expect(plan).toBeNull();
  });

  it("refuses multi-hop when a barrier blocks without openings", () => {
    const world = chainWorld();
    const a = axialToPixel(0, 0, SIZE);
    const b = axialToPixel(1, 0, SIZE);
    // Fence across the A–B border corridor
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    world.travelCtx = {
      barriers: [
        {
          kind: "fence",
          a: { x: mid.x, y: mid.y - 40 },
          b: { x: mid.x, y: mid.y + 40 },
        },
      ],
      openings: [],
    };
    const plan = planKnownHexPath({
      fromHexId: "a",
      fromStand: a,
      toHexId: "b",
      discovered: ["a", "b", "c"],
      ...world,
    });
    expect(plan).toBeNull();
  });

  it("allows multi-hop through a barrier only when an opening covers the crossing", () => {
    const world = chainWorld();
    const a = axialToPixel(0, 0, SIZE);
    const b = axialToPixel(1, 0, SIZE);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const fence = {
      kind: "fence",
      a: { x: mid.x, y: mid.y - 40 },
      b: { x: mid.x, y: mid.y + 40 },
    };
    const discovered = ["a", "b", "c"];

    world.travelCtx = { barriers: [fence], openings: [] };
    expect(
      planKnownHexPath({
        fromHexId: "a",
        fromStand: a,
        toHexId: "b",
        discovered,
        ...world,
      }),
    ).toBeNull();

    // Gate opening on the from-hex covers the A–B fence crossing.
    world.travelCtx = {
      barriers: [fence],
      openings: [{ kind: "gate", hex: "a", x: mid.x, y: mid.y, r: 24 }],
    };
    const openPlan = planKnownHexPath({
      fromHexId: "a",
      fromStand: a,
      toHexId: "c",
      discovered,
      ...world,
    });
    expect(openPlan).not.toBeNull();
    expect(openPlan.steps.map((s) => s.hexId)).toEqual(["b", "c"]);
  });

  it("plans outdoor hex steps only (never auto-enters a building)", () => {
    const world = chainWorld();
    world.hexById.c = {
      ...world.hexById.c,
      landmark: { building: "any-building" },
    };
    const stand = axialToPixel(0, 0, SIZE);
    const plan = planKnownHexPath({
      fromHexId: "a",
      fromStand: stand,
      toHexId: "c",
      discovered: ["a", "b", "c"],
      ...world,
    });
    expect(plan).not.toBeNull();
    expect(plan.steps.map((s) => s.hexId)).toEqual(["b", "c"]);
    // Pure planner has no place/map transition — caller must not auto-enter.
    for (const step of plan.steps) {
      expect(step.place).toBeUndefined();
      expect(step.enterBuilding).toBeUndefined();
    }
  });
});
