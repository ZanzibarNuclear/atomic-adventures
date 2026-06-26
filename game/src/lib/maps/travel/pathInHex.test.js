import { describe, expect, it } from "vitest";
import { pathInHex } from "./pathInHex.js";
import { segmentIntersection } from "../geometry/segments.js";

const size = 44;
const hex = { id: "test", q: 0, r: 0 };

function pathClear(path, ctx) {
  for (let i = 1; i < path.length; i++) {
    for (const barrier of ctx.barriers ?? []) {
      if (segmentIntersection(path[i - 1], path[i], barrier.a, barrier.b)) {
        return false;
      }
    }
  }
  return true;
}

describe("pathInHex", () => {
  it("returns a direct path when the segment is clear", () => {
    const from = { x: -10, y: 0 };
    const to = { x: 10, y: 0 };

    expect(pathInHex(hex, from, to, { barriers: [] }, size, pathClear)).toEqual([from, to]);
  });

  it("finds a local route around a single barrier", () => {
    const from = { x: -30, y: -20 };
    const to = { x: 30, y: -20 };
    const ctx = {
      barriers: [{ kind: "fence", a: { x: 0, y: -32 }, b: { x: 0, y: 8 } }],
    };

    const path = pathInHex(hex, from, to, ctx, size, pathClear);

    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(2);
    expect(path.at(0)).toEqual(from);
    expect(path.at(-1)).toEqual(to);
    expect(pathClear(path, ctx)).toBe(true);
  });

  it("returns null when either endpoint is outside the hex", () => {
    const from = { x: -200, y: 0 };
    const to = { x: 0, y: 0 };

    expect(pathInHex(hex, from, to, { barriers: [] }, size, pathClear)).toBeNull();
  });
});
