import { describe, expect, it } from "vitest";
import { applyHexRenames, validateWorld } from "./world-model.js";
import { loadContentDocuments } from "./test-content.js";

function loadWorld() {
  return structuredClone(loadContentDocuments().world);
}

describe("world model", () => {
  it("rejects coordinate collisions and broken anchors", () => {
    const world = loadWorld();
    world.hexes[1].q = world.hexes[0].q;
    world.hexes[1].r = world.hexes[0].r;
    world.routes[0].points[0] = { hex: "missing-hex", dx: 0, dy: 0 };
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.errors["hexes.1.coordinates"]).toBeDefined();
    expect(result.errors["routes.0.points.0"]).toBeDefined();
  });

  it("cascades hex renames through map-level references", () => {
    const world = loadWorld();
    const origin = world.hexes.find((hex) => hex.id === "origin");
    origin.id = "arrival-trail";
    applyHexRenames(world, [{ kind: "hex", from: "origin", to: "arrival-trail" }]);
    expect(world.start).toBe("arrival-trail");
    expect(world.journey).toContain("arrival-trail");
    expect(validateWorld(world).valid).toBe(true);
  });

  it("validates river cascade ranges", () => {
    const world = loadWorld();
    const river = world.features.find((feature) => feature.kind === "river");
    river.cascades = [{ id: "utility-falls", from: 0.55, to: 0.82 }];
    expect(validateWorld(world).valid).toBe(true);

    river.cascades = [{ id: "bad falls", from: -0.1, to: 1.4 }];
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.errors["features.0.cascades.0.id"]).toBeDefined();
    expect(result.errors["features.0.cascades.0.from"]).toBeDefined();
    expect(result.errors["features.0.cascades.0.to"]).toBeDefined();
  });

  it("allows stand entryFrom references to hexes declared later in the world", () => {
    const world = {
      orientation: "pointy",
      size: 44,
      start: "utility-yard",
      journey: ["utility-yard", "south-pines"],
      hexes: [
        {
          id: "utility-yard",
          q: 0,
          r: 0,
          stands: [
            {
              id: "man-door",
              at: { dx: 0, dy: 0 },
              entryFrom: ["south-pines"],
            },
          ],
        },
        { id: "south-pines", q: 0, r: 1 },
      ],
      routes: [],
      features: [],
    };

    const result = validateWorld(world);

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("keeps road-like travel geometry in routes instead of features", () => {
    const world = loadWorld();
    world.features.push({
      id: "duplicate-road",
      kind: "road",
      points: [
        { hex: "origin", dx: 0, dy: 0 },
        { hex: "east-pines", dx: 0, dy: 0 },
      ],
    });
    const result = validateWorld(world);

    expect(result.valid).toBe(false);
    expect(result.errors[`features.${world.features.length - 1}.kind`]).toContain(
      "Roads, drives, paths, and trails belong in routes, not features.",
    );
  });
});
