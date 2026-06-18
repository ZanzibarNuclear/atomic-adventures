import { describe, expect, it } from "vitest";
import { loadWorldSeed } from "./world-catalog.js";
import { applyHexRenames, validateWorld } from "./world-model.js";

describe("world model", () => {
  it("rejects coordinate collisions and broken anchors", () => {
    const world = structuredClone(loadWorldSeed());
    world.hexes[1].q = world.hexes[0].q;
    world.hexes[1].r = world.hexes[0].r;
    world.routes[0].points[0] = { hex: "missing-hex", dx: 0, dy: 0 };
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.errors["hexes.1.coordinates"]).toBeDefined();
    expect(result.errors["routes.0.points.0"]).toBeDefined();
  });

  it("cascades hex renames through map-level references", () => {
    const world = structuredClone(loadWorldSeed());
    const trailhead = world.hexes.find((hex) => hex.id === "trailhead");
    trailhead.id = "arrival-trail";
    applyHexRenames(world, [{ kind: "hex", from: "trailhead", to: "arrival-trail" }]);
    expect(world.start).toBe("arrival-trail");
    expect(world.journey).toContain("arrival-trail");
    expect(validateWorld(world).valid).toBe(true);
  });
});
