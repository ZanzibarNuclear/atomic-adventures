import { describe, expect, it } from "vitest";
import { validateStorylineDocument } from "./storyline-model.js";
import { storylineSeed } from "./storyline-seed.js";

const world = {
  hexIds: new Set(["utility-yard"]),
  roomIds: new Set(["control-room"]),
  exteriorNodeIds: new Set(["intake-entrance"]),
  mapTransitionIds: new Set(["garage-exit"]),
};

const character = {
  items: [{ id: "hydro-startup-card" }],
  stats: [],
  knowledge: [],
  skills: [],
  quests: [],
  documents: [],
};

const learning = {
  lessons: [{ id: "hydro-power-intro-alpha" }],
};

describe("storyline model", () => {
  it("validates the seeded alpha scenario shape", () => {
    const result = validateStorylineDocument(storylineSeed, { world, character, learning });
    expect(result.valid).toBe(true);
    expect(result.storyline.id).toBe("storyline-main");
    expect(result.storyline.scenarios[0].id).toBe("part-i-hydro-alpha");
  });

  it("rejects unresolved movement references", () => {
    const draft = structuredClone(storylineSeed);
    draft.scenarios[0].steps[0].allowed = {
      movement: { hexes: ["missing-hex"] },
    };

    const result = validateStorylineDocument(draft, { world, character, learning });
    expect(result.valid).toBe(false);
    expect(result.errors["scenarios.0.steps.0.allowed.movement.hexes"]).toContain(
      "Choose an existing hex.",
    );
  });

  it("keeps completion predicates typed to one family", () => {
    const draft = structuredClone(storylineSeed);
    draft.scenarios[0].steps[0].completesWhen = {
      flag: "story.intro.complete",
      location: { place: "indoors", room: "control-room" },
    };

    const result = validateStorylineDocument(draft, { world, character, learning });
    expect(result.valid).toBe(false);
    expect(result.errors["scenarios.0.steps.0.completesWhen"]).toContain(
      "Choose exactly one completion predicate.",
    );
  });
});
