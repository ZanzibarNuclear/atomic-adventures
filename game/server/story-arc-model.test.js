import { describe, expect, it } from "vitest";
import { validateStoryArcDocument } from "./story-arc-model.js";
import { storyArcSeed } from "./story-arc-seed.js";

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
  lessons: [{ id: "hydro-power-stream-to-socket" }],
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

describe("story arc transport model", () => {
  it("validates the seeded Part I story arc shape", () => {
    const result = validateStoryArcDocument(storyArcSeed, { story, world, character, learning });
    expect(result.valid).toBe(true);
    expect(result.storyArcDocument.id).toBe("story-main");
    expect(result.storyArcDocument.storyArcs[0].id).toBe("part-i-opener");
    expect(result.storyArcDocument.storyArcs[1].id).toBe("part-i-station");
  });

  it("rejects unresolved movement references", () => {
    const draft = structuredClone(storyArcSeed);
    draft.storyArcs[0].beats[0].allowed = {
      movement: { hexes: ["missing-hex"] },
    };

    const result = validateStoryArcDocument(draft, { world, character, learning });
    expect(result.valid).toBe(false);
    expect(result.errors["storyArcs.0.beats.0.allowed.movement.hexes"]).toContain(
      "Choose an existing hex.",
    );
  });

  it("keeps completion conditions typed to one family", () => {
    const draft = structuredClone(storyArcSeed);
    draft.storyArcs[0].beats[0].completesWhen = {
      flag: "story.intro.complete",
      location: { place: "indoors", room: "control-room" },
    };

    const result = validateStoryArcDocument(draft, { world, character, learning });
    expect(result.valid).toBe(false);
    expect(result.errors["storyArcs.0.beats.0.completesWhen"]).toContain(
      "Choose exactly one completion condition.",
    );
  });

  it("validates completion locations with alternate destination hexes", () => {
    const draft = structuredClone(storyArcSeed);
    draft.storyArcs[0].beats[2].completesWhen = {
      location: { place: "outdoors", hex: ["gate-woods", "utility-yard"] },
    };

    const result = validateStoryArcDocument(draft, { story, world, character, learning });
    expect(result.valid).toBe(true);
    expect(result.storyArcDocument.storyArcs[0].beats[2].completesWhen.location.hex).toEqual([
      "gate-woods",
      "utility-yard",
    ]);
  });

  it("rejects unresolved story arc handoffs", () => {
    const draft = structuredClone(storyArcSeed);
    draft.storyArcs[0].beats.at(-1).nextArc = "missing-arc";

    const result = validateStoryArcDocument(draft, { world, character, learning });
    expect(result.valid).toBe(false);
    expect(result.errors["storyArcs.0.beats.2.nextArc"]).toContain(
      "Choose an existing next story arc.",
    );
  });
});
