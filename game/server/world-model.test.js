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
    world.artifactPlacements = [{
      id: "origin-field-manual",
      hex: "origin",
      item: "field-manual",
      label: "Field manual",
    }];
    origin.id = "arrival-trail";
    applyHexRenames(world, [{ kind: "hex", from: "origin", to: "arrival-trail" }]);
    expect(world.start).toBe("arrival-trail");
    expect(world.journey).toContain("arrival-trail");
    expect(world.artifactPlacements[0].hex).toBe("arrival-trail");
    expect(validateWorld(world).valid).toBe(true);
  });

  it("validates outdoor artifact placements against authored hexes", () => {
    const world = loadWorld();
    world.artifactPlacements = [{
      id: "missing-field-manual",
      hex: "missing",
      item: "field manual",
      label: "Field manual",
    }];
    const result = validateWorld(world);

    expect(result.valid).toBe(false);
    expect(result.errors["artifactPlacements.0.hex"]).toBeDefined();
    expect(result.errors["artifactPlacements.0.item"]).toBeDefined();
  });

  it("validates outdoor artifact placement stands against the placement hex", () => {
    const world = loadWorld();
    const yard = world.hexes.find((hex) => hex.id === "utility-yard");
    expect(yard.stands.some((stand) => stand.id === "man-door")).toBe(true);
    world.artifactPlacements = [{
      id: "yard-field-manual",
      hex: "utility-yard",
      stand: "man-door",
      item: "field-manual",
      label: "Field manual",
    }];
    expect(validateWorld(world).valid).toBe(true);

    world.artifactPlacements[0].stand = "missing-stand";
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.errors["artifactPlacements.0.stand"]).toBeDefined();
  });

  it("validates hex and stand location image views", () => {
    const world = loadWorld();
    const yard = world.hexes.find((hex) => hex.id === "utility-yard");
    yard.views = [{
      id: "yard",
      kind: "image",
      src: "views/garage-large-bay.png",
      alt: "The utility yard.",
    }];
    yard.stands[0].views = [{
      id: "doorway",
      kind: "image",
      src: "views/conference-room-cool-doorway.png",
      alt: "A doorway view.",
    }];
    expect(validateWorld(world).valid).toBe(true);

    const yardIndex = world.hexes.findIndex((hex) => hex.id === "utility-yard");
    yard.views = [{ id: "bad path", kind: "image", src: "items/field-backpack.png" }];
    const result = validateWorld(world);
    expect(result.valid).toBe(false);
    expect(result.errors[`hexes.${yardIndex}.views.0.id`]).toBeDefined();
    expect(result.errors[`hexes.${yardIndex}.views.0.src`]).toBeDefined();
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
