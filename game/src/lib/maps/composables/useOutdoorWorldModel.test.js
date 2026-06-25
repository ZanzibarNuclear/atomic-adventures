import { describe, expect, it } from "vitest";
import { useOutdoorWorldModel } from "./useOutdoorWorldModel.js";

describe("useOutdoorWorldModel", () => {
  it("builds editable map state and model lookups from map data", () => {
    const model = useOutdoorWorldModel({
      size: 44,
      start: "origin",
      hexes: [
        { id: "origin", q: 0, r: 0 },
        { id: "east", q: 1, r: 0 },
      ],
      features: [
        { id: "gate", kind: "gate", hex: "origin", at: { x: 0, y: 0 } },
        { id: "fence", kind: "fence", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      ],
      routes: [
        { id: "road", kind: "road", points: [{ hex: "origin" }, { hex: "east" }] },
      ],
    });

    expect(model.startId.value).toBe("origin");
    expect(model.hexById.value.east.q).toBe(1);
    expect(model.mapFeatures.value.map((feature) => feature.id)).toEqual(["fence"]);
    expect(model.featureModels.value).toHaveLength(1);
    expect(model.routeModels.value).toHaveLength(1);
    expect(model.hexAtPoint({ x: 0, y: 0 }, null)).toBe("origin");
  });

  it("syncs editable state from new map data", () => {
    const model = useOutdoorWorldModel({
      size: 44,
      start: "origin",
      hexes: [{ id: "origin", q: 0, r: 0 }],
      features: [],
      routes: [],
    });

    model.syncFromMapData({
      size: 50,
      start: "next",
      hexes: [{ id: "next", q: 1, r: 0 }],
      features: [{ id: "river", kind: "river", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
      routes: [],
    });

    expect(model.size.value).toBe(50);
    expect(model.startId.value).toBe("next");
    expect(model.editableHexes.value.map((hex) => hex.id)).toEqual(["next"]);
    expect(model.rivers.value).toHaveLength(1);
  });
});
