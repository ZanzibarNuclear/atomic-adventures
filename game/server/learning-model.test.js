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
    expect(result.learning.lessons[0].sections.map((section) => section.title)).toEqual([
      "Water Above, Power Below",
      "From Water To Wires",
      "Head, Flow, And Losses",
      "Net Head",
      "Electrical Power",
      "What the Symbols Mean",
      "Quick Examples",
      "Plant Styles",
    ]);
    expect(result.learning.lessons[0].quiz[0]).toEqual(expect.objectContaining({
      id: "same-power",
      correctOptionId: "same",
    }));
    expect(result.learning.lessons[0].sections.find((section) => section.title === "Electrical Power").formula)
      .toContain("\\eta");
    expect(result.learning.lessons[0].sections.find((section) => section.title === "What the Symbols Mean").rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ symbol: "$\\rho$" }),
        expect.objectContaining({ symbol: "$\\sum h_L$" }),
      ]));
  });

  it("validates the hidden alpha hydro rewrite with a diagram section", () => {
    const result = validateLearningDocument(learningSeed, { character });
    const alphaLesson = result.learning.lessons.find((lesson) => lesson.id === "hydro-power-intro-alpha");

    expect(result.valid).toBe(true);
    expect(result.learning.lessons[0].published).toBe(true);
    expect(alphaLesson.published).toBe(true);
    expect(alphaLesson.completion.effects).toEqual([
      { op: "knowledge.acquire", id: "hydro-head-and-flow" },
    ]);
    expect(alphaLesson.sections.find((section) => section.type === "image")).toEqual(
      expect.objectContaining({
        src: "/learning/hydro/cascading-waterfall-head.png",
        alt: expect.stringContaining("waterfall"),
      }),
    );
    expect(alphaLesson.sections.find((section) => section.type === "diagram")).toEqual(
      expect.objectContaining({
        title: "Picture The Water Path",
        steps: [
          "High water",
          "Intake screen",
          "Penstock pressure pipe",
          "Turbine",
          "Generator shaft",
          "Tailrace",
        ],
      }),
    );
  });

  it("rejects missing completion effect references", () => {
    const candidate = structuredClone(learningSeed);
    candidate.lessons[0].completion.effects[0].id = "missing-knowledge";

    const result = validateLearningDocument(candidate, { character });

    expect(result.valid).toBe(false);
    expect(result.errors["lessons.0.completion.effects.0.id"]).toBeTruthy();
  });
});
