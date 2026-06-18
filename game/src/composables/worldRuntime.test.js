import { describe, expect, it } from "vitest";
import mapData from "../../content/world/map.yaml";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { applyOutdoorWorldUpdate } from "./worldRuntime.js";

describe("outdoor world live replacement", () => {
  it("preserves a valid location and filters removed discoveries", () => {
    const outdoor = useOutdoorWorld(mapData);
    outdoor.state.currentId = "gate-woods";
    outdoor.state.discovered = ["trailhead", "gate-woods", "removed-hex"];
    outdoor.state.discoveredOpenings = ["compound-gate", "removed-opening"];
    outdoor.state.lastBlocked = "fence";

    const next = structuredClone(mapData);
    const gate = next.hexes.find((hex) => hex.id === "gate-woods");
    gate.standAt = { dx: 0, dy: 0 };
    applyOutdoorWorldUpdate(outdoor, next);

    expect(outdoor.state.currentId).toBe("gate-woods");
    expect(outdoor.state.discovered).toEqual(["trailhead", "gate-woods"]);
    expect(outdoor.state.discoveredOpenings).toEqual(["compound-gate"]);
    expect(outdoor.state.stand).toEqual(outdoor.defaultStandForHex("gate-woods"));
    expect(outdoor.state.lastBlocked).toBeNull();
  });

  it("falls back to the authored start when the current hex was removed", () => {
    const outdoor = useOutdoorWorld(mapData);
    outdoor.state.currentId = "far-pines";
    const next = structuredClone(mapData);
    next.hexes = next.hexes.filter((hex) => hex.id !== "far-pines");

    expect(applyOutdoorWorldUpdate(outdoor, next)).toBe(next.start);
    expect(outdoor.state.currentId).toBe(next.start);
  });
});
