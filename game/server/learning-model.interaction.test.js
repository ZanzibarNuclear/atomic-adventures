import { describe, expect, it } from "vitest";
import { learningSeed } from "./learning-seed.js";
import { normalizeLearningDocument, validateLearningDocument } from "./learning-model.js";

describe("learning interaction blocks", () => {
  it("accepts registered hydro-penstock-lab interactions in seed content", () => {
    const validation = validateLearningDocument(learningSeed);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      // eslint-disable-next-line no-console
      console.error(validation.errors);
    }
  });

  it("rejects unknown interaction ids", () => {
    const doc = normalizeLearningDocument({
      id: "learning-main",
      lessons: [
        {
          id: "test-lesson",
          title: "Test",
          pages: [
            {
              id: "p1",
              frames: [
                {
                  id: "f1",
                  kind: "content",
                  blocks: [
                    { type: "interaction", interactionId: "not-registered" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const validation = validateLearningDocument(doc);
    expect(validation.valid).toBe(false);
    expect(JSON.stringify(validation.errors)).toMatch(/Unknown interaction/);
  });

  it("seeds a penstock lab page on the stream-to-socket lesson", () => {
    const labPage = learningSeed.lessons
      .find((lesson) => lesson.id === "hydro-power-stream-to-socket")
      ?.pages?.find((page) => page.id === "penstock-lab-page");
    expect(labPage).toBeTruthy();
    const interaction = labPage.frames
      .flatMap((frame) => frame.blocks)
      .find((block) => block.type === "interaction");
    expect(interaction?.interactionId).toBe("hydro-penstock-lab");
    expect(interaction?.preset).toBe("clearwater");
  });
});
