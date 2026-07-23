import { describe, expect, it } from "vitest";
import { buildStoryBeatMatchWarnings } from "./storyBeatMatchWarnings.js";

describe("story scene match warnings", () => {
  it("treats flag-specific scenes as distinct authoring variants", () => {
    const warnings = buildStoryBeatMatchWarnings([
      {
        id: "gate-first-look",
        trigger: { place: "outdoors", hex: "gate-woods" },
        modes: ["story"],
        storyBeat: "reach-the-gate",
        match: {},
        time: {},
        conditions: { flags: { not: ["gate.inspected"] } },
      },
      {
        id: "gate-inspected",
        trigger: { place: "outdoors", hex: "gate-woods" },
        modes: ["story"],
        storyBeat: "reach-the-gate",
        match: {},
        time: {},
        conditions: { flags: { all: ["gate.inspected"], not: ["gate.vines-untangled"] } },
      },
    ], {
      locationMode: "outdoors",
      selectedLocation: "gate-woods",
    });

    expect(warnings).toEqual([]);
  });

  it("does not treat room-wide and stand-scoped scenes as the same collision", () => {
    const warnings = buildStoryBeatMatchWarnings([
      {
        id: "kitchen",
        trigger: { place: "indoors", room: "kitchen" },
        modes: [],
        match: {},
        time: {},
        conditions: {},
      },
      {
        id: "kitchen-cabinets",
        trigger: { place: "indoors", room: "kitchen", stand: "cabinets" },
        modes: [],
        match: {},
        time: {},
        conditions: {},
      },
      {
        id: "food-in-cabinet",
        trigger: { place: "indoors", room: "kitchen", stand: "cabinets" },
        modes: ["story"],
        storyBeat: "day1-food",
        match: {},
        time: {},
        conditions: {},
      },
      {
        id: "kitchen-open-world",
        trigger: { place: "indoors", room: "kitchen" },
        modes: ["open-world"],
        match: {},
        time: {},
        conditions: {},
      },
    ], {
      locationMode: "rooms",
      selectedLocation: "kitchen",
    });

    // Room-wide vs cabinets are different. Mode scopes also separate story/open-world.
    // Only true collisions remain: none in this complementary set once stand+mode split.
    expect(warnings.every((warning) => !warning.includes("kitchen, kitchen-cabinets"))).toBe(true);
    expect(warnings.every((warning) => warning.includes("scenes"))).toBe(true);
  });

  it("still warns when two scenes share the same stand and criteria", () => {
    const warnings = buildStoryBeatMatchWarnings([
      {
        id: "cabinets-a",
        trigger: { place: "indoors", room: "kitchen", stand: "cabinets" },
        modes: [],
        match: {},
        time: {},
        conditions: {},
      },
      {
        id: "cabinets-b",
        trigger: { place: "indoors", room: "kitchen", stand: "cabinets" },
        modes: [],
        match: {},
        time: {},
        conditions: {},
      },
    ], {
      locationMode: "rooms",
      selectedLocation: "kitchen",
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("stand cabinets");
    expect(warnings[0]).toContain("cabinets-a");
    expect(warnings[0]).toContain("cabinets-b");
    expect(warnings[0]).toContain("scenes");
  });
});
