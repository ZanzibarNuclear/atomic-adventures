import { describe, expect, it } from "vitest";
import { buildStoryBeatMatchWarnings } from "./storyBeatMatchWarnings.js";

describe("story beat match warnings", () => {
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
});
