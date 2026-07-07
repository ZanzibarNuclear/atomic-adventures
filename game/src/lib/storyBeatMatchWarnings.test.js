import { describe, expect, it } from "vitest";
import { buildStoryBeatMatchWarnings } from "./storyBeatMatchWarnings.js";

const baseBeat = {
  trigger: { place: "outdoors", hex: "utility-yard" },
  match: { originHex: null, mapTransition: null, transitionDirection: null },
  time: {},
  choices: [],
};

function beat(id, fields = {}) {
  return {
    ...baseBeat,
    id,
    ...fields,
  };
}

function warnings(beats) {
  return buildStoryBeatMatchWarnings(beats, {
    locationMode: "outdoors",
    selectedLocation: "utility-yard",
  });
}

describe("story beat match warnings", () => {
  it("does not warn for beats split between story and open-world modes", () => {
    expect(warnings([
      beat("story-beat", { modes: ["story"] }),
      beat("open-world-beat", { modes: ["open-world"] }),
    ])).toEqual([]);
  });

  it("warns when a both-mode beat overlaps a story-only beat", () => {
    expect(warnings([
      beat("ambient"),
      beat("story-beat", { modes: ["story"] }),
    ])).toEqual([
      "Multiple beats use default/no origin or map transition: ambient, story-beat. The first sorted beat wins.",
    ]);
  });

  it("does not warn for distinct storyline steps", () => {
    expect(warnings([
      beat("intro", { modes: ["story"], storylineStep: "intro" }),
      beat("card", { modes: ["story"], storylineStep: "understand-building" }),
    ])).toEqual([]);
  });

  it("warns when an ambient story beat overlaps a storyline step beat", () => {
    expect(warnings([
      beat("ambient", { modes: ["story"] }),
      beat("intro", { modes: ["story"], storylineStep: "intro" }),
    ])).toEqual([
      "Multiple beats use default/no origin or map transition: ambient, intro. The first sorted beat wins.",
    ]);
  });
});
