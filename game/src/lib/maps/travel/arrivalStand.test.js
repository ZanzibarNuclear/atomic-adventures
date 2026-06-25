import { describe, expect, it } from "vitest";
import { pathEndInHex, resolveArrivalStand, routeStandInHex } from "./arrivalStand.js";

function hexAtPoint(point) {
  if (point.x < 0) return "west";
  if (point.x <= 100) return "east";
  return "far";
}

describe("arrival stand helpers", () => {
  it("chooses the midpoint of route samples inside a hex", () => {
    const path = [
      { x: -20, y: 0 },
      { x: 10, y: 0 },
      { x: 30, y: 0 },
      { x: 60, y: 0 },
      { x: 120, y: 0 },
    ];

    expect(routeStandInHex(path, "east", hexAtPoint)).toEqual({ x: 30, y: 0 });
    expect(pathEndInHex(path, "east", hexAtPoint)).toEqual({ x: 60, y: 0 });
  });

  it("uses an authored absolute stand before route midpoint fallback", () => {
    const toHex = {
      id: "east",
      stands: [{ id: "arrival", at: { x: 42, y: 7 } }],
    };

    expect(resolveArrivalStand(
      [{ x: -20, y: 0 }, { x: 20, y: 0 }, { x: 60, y: 0 }],
      toHex,
      { x: 0, y: 0 },
      hexAtPoint,
    )).toEqual({ x: 42, y: 7 });
  });

  it("falls back to a route stand for multi-sample walks", () => {
    const path = [
      { x: -20, y: 0 },
      { x: 10, y: 0 },
      { x: 30, y: 0 },
      { x: 120, y: 0 },
    ];

    expect(resolveArrivalStand(path, { id: "east" }, { x: 0, y: 0 }, hexAtPoint)).toEqual({
      x: 30,
      y: 0,
    });
  });
});
