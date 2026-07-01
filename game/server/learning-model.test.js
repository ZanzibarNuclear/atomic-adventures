import { describe, expect, it } from "vitest";
import { validateLearningDocument } from "./learning-model.js";
import { learningSeed } from "./learning-seed.js";

const character = {
  knowledge: [{ id: "hydro-head-and-flow", label: "Hydro head and flow" }],
  items: [],
  stats: [],
  skills: [],
  quests: [],
  documents: [],
};

describe("learning model", () => {
  it("validates the seeded hydro intro lesson", () => {
    const result = validateLearningDocument(learningSeed, { character });

    expect(result.valid).toBe(true);
    expect(result.learning.lessons[0].id).toBe("hydro-power-intro");
  });

  it("rejects missing completion effect references", () => {
    const candidate = structuredClone(learningSeed);
    candidate.lessons[0].completion.effects[0].id = "missing-knowledge";

    const result = validateLearningDocument(candidate, { character });

    expect(result.valid).toBe(false);
    expect(result.errors["lessons.0.completion.effects.0.id"]).toBeTruthy();
  });
});
