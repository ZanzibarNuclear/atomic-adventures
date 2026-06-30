import { describe, expect, it } from "vitest";
import {
  BARRIER_KINDS,
  BARRIER_OPENING_KINDS,
  barrierList,
  barrierSegments,
  fenceSegments,
  firstBlockedOnPath,
  firstBlockedOnPathInHex,
  pathCrossesBarrier,
  riverSegments,
} from "./barrierContext.js";

describe("barrier context", () => {
  it("declares barrier and opening kinds", () => {
    expect(BARRIER_KINDS).toEqual(["fence", "river", "cliff", "ravine"]);
    expect(BARRIER_OPENING_KINDS.has("gate")).toBe(true);
    expect(BARRIER_OPENING_KINDS.has("bridge")).toBe(true);
    expect(BARRIER_OPENING_KINDS.has("road")).toBe(false);
  });

  it("extracts barrier segments from feature route models", () => {
    const models = [
      { kind: "fence", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
      { kind: "river", points: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
      { kind: "road", points: [{ x: 0, y: 2 }, { x: 1, y: 2 }] },
    ];
    expect(barrierSegments(models)).toEqual([
      { kind: "fence", a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
      { kind: "fence", a: { x: 1, y: 0 }, b: { x: 2, y: 0 } },
      { kind: "river", a: { x: 0, y: 1 }, b: { x: 1, y: 1 } },
    ]);
    expect(fenceSegments(models)).toHaveLength(2);
    expect(riverSegments(models)).toHaveLength(1);
  });

  it("uses the current barrier segment list from the travel context", () => {
    const barriers = [{ kind: "fence" }];
    expect(barrierList({ barriers })).toBe(barriers);
    expect(barrierList({})).toEqual([]);
  });

  it("finds the first blocking barrier hit while ignoring path-origin contact", () => {
    const ctx = {
      barriers: [{ kind: "fence", a: { x: 100, y: -80 }, b: { x: 100, y: 200 } }],
      openings: [{ kind: "gate", x: 100, y: 100, r: 22 }],
    };

    expect(pathCrossesBarrier(
      { x: 50, y: 100 },
      { x: 150, y: 100 },
      ctx.barriers[0].a,
      ctx.barriers[0].b,
    )).toBe(true);
    expect(firstBlockedOnPath([{ x: 50, y: 100 }, { x: 150, y: 100 }], ctx)).toMatchObject({
      kind: "fence",
      x: 100,
      y: 100,
      segIndex: 0,
    });
    expect(firstBlockedOnPath([{ x: 100, y: 100 }, { x: 180, y: 100 }], ctx)).toBeNull();
  });

  it("filters first hits to the requested hex", () => {
    const ctx = {
      barriers: [{ kind: "river", a: { x: 50, y: 50 }, b: { x: 150, y: 50 } }],
    };
    const path = [{ x: 100, y: 0 }, { x: 100, y: 100 }];
    const hexAtPoint = (point) => point.y < 75 ? "north" : "south";

    expect(firstBlockedOnPathInHex(path, ctx, "north", hexAtPoint)?.kind).toBe("river");
    expect(firstBlockedOnPathInHex(path, ctx, "south", hexAtPoint)).toBeNull();
  });
});
