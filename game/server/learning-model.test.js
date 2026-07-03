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
    const firstLesson = result.learning.lessons[0];
    const firstLessonFrames = firstLesson.pages.flatMap((page) => page.frames);
    const firstLessonBlocks = firstLessonFrames.flatMap((frame) => frame.blocks);
    const firstQuiz = firstLessonFrames.find((frame) => frame.kind === "quiz");

    expect(result.valid).toBe(true);
    expect(firstLesson.id).toBe("hydro-power-intro");
    expect(firstLessonFrames.filter((frame) => frame.kind === "content").map((frame) => frame.title)).toEqual([
      "Water Above, Power Below",
      "From Water To Wires",
      "Head, Flow, And Losses",
      "Net Head",
      "Electrical Power",
      "What the Symbols Mean",
      "Quick Examples",
      "Plant Styles",
    ]);
    expect(firstQuiz.questions[0]).toEqual(expect.objectContaining({
      id: "same-power",
      correctOptionId: "same",
    }));
    expect(firstLessonBlocks.find((block) => block.formula?.includes("P_\\text{elec}")).formula)
      .toContain("\\eta");
    expect(firstLessonBlocks.find((block) => block.rows?.some((row) => row.symbol === "$\\rho$")).rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ symbol: "$\\rho$" }),
        expect.objectContaining({ symbol: "$\\sum h_L$" }),
      ]));
  });

  it("validates the published alpha hydro rewrite as paged mixed content", () => {
    const result = validateLearningDocument(learningSeed, { character });
    const alphaLesson = result.learning.lessons.find((lesson) => lesson.id === "hydro-power-intro-alpha");
    const alphaFrames = alphaLesson.pages.flatMap((page) => page.frames);
    const alphaBlocks = alphaFrames.flatMap((frame) => frame.blocks);

    expect(result.valid).toBe(true);
    expect(result.learning.lessons[0].published).toBe(true);
    expect(alphaLesson.published).toBe(true);
    expect(alphaLesson.pages.map((page) => page.id)).toEqual([
      "water-and-height",
      "water-path",
      "powerhouse",
      "field-checks",
    ]);
    expect(alphaLesson.completion.effects).toEqual([
      { op: "knowledge.acquire", id: "hydro-head-and-flow" },
    ]);
    expect(alphaBlocks.find((block) => block.type === "image")).toEqual(
      expect.objectContaining({
        src: "/learning/hydro/cascading-waterfall-head.png",
        alt: expect.stringContaining("waterfall"),
      }),
    );
    expect(alphaBlocks.find((block) => block.type === "diagram")).toEqual(
      expect.objectContaining({
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
    expect(alphaFrames.filter((frame) => frame.kind === "quiz").flatMap((frame) => frame.questions).map((question) => question.id))
      .toEqual(["trace-water-path", "identify-head", "spot-power-loss"]);
  });

  it("rejects missing completion effect references", () => {
    const candidate = structuredClone(learningSeed);
    candidate.lessons[0].completion.effects[0].id = "missing-knowledge";

    const result = validateLearningDocument(candidate, { character });

    expect(result.valid).toBe(false);
    expect(result.errors["lessons.0.completion.effects.0.id"]).toBeTruthy();
  });
});
