import { describe, expect, it } from "vitest";
import {
  BARRIER_KINDS,
  BARRIER_OPENING_KINDS,
  barrierList,
  barrierSegments,
  fenceSegments,
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

  it("supports legacy fence/river contexts", () => {
    const fences = [{ kind: "fence" }];
    const rivers = [{ kind: "river" }];
    expect(barrierList({ fences, rivers })).toEqual([...fences, ...rivers]);
    expect(barrierList({ barriers: fences })).toBe(fences);
  });
});
