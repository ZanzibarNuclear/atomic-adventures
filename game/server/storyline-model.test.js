import { describe, expect, it } from "vitest";
import { validateStorylineDocument } from "./storyline-model.js";
import { storylineSeed } from "./storyline-seed.js";

const world = {
  hexIds: new Set([
    "east-pines",
    "center-pines",
    "north-bend",
    "gate-woods",
    "south-pines",
    "west-slope",
    "utility-yard",
  ]),
  roomIds: new Set(["large-bay", "garage-stair", "conference", "kitchen", "library", "control-room"]),
  exteriorNodeIds: new Set([
    "garage-front-entrance",
    "large-bay-man-front",
    "south-east-corner-entrance",
    "intake-entrance",
    "upstream-bank",
  ]),
  mapTransitionIds: new Set(["garage-exit", "man-door-path", "southeast-corner"]),
};

const character = {
  items: [{ id: "hydro-startup-instruction-card" }],
  stats: [],
  knowledge: [],
  skills: [],
  quests: [],
  documents: [],
};

const learning = {
  lessons: [{ id: "hydro-power-intro-alpha" }],
};

const story = {
  areas: {
    "part-i": {
      beats: Object.fromEntries([
        "intro",
        "east-pines",
        "center-pines",
        "the-gate",
        "large-bay-man-front",
        "large-bay",
        "control-room",
        "intake-entrance",
        "midstream-bank",
        "downstream-bank",
      ].map((id) => [id, { text: id }])),
    },
  },
};

describe("storyline model", () => {
  it("validates the seeded alpha scenario shape", () => {
    const result = validateStorylineDocument(storylineSeed, { story, world, character, learning });
    expect(result.valid).toBe(true);
    expect(result.storyline.id).toBe("storyline-main");
    expect(result.storyline.scenarios[0].id).toBe("part-i-opener");
    expect(result.storyline.scenarios[1].id).toBe("part-i-station");
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

  it("rejects unresolved scenario handoffs", () => {
    const draft = structuredClone(storylineSeed);
    draft.scenarios[0].steps.at(-1).nextScenario = "missing-scenario";

    const result = validateStorylineDocument(draft, { world, character, learning });
    expect(result.valid).toBe(false);
    expect(result.errors["scenarios.0.steps.2.nextScenario"]).toContain(
      "Choose an existing next scenario.",
    );
  });
});
