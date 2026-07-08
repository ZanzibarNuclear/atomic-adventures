import { describe, expect, it } from "vitest";
import { buildStoryChoices, getMovementOptions } from "./usePlayPanel.js";

describe("play panel story choices", () => {
  it("does not show movement choices that target the current outdoor hex", () => {
    const beat = {
      choices: [
        {
          id: "head-downhill-along-the-fence",
          text: "Head downhill along the fence",
          go_hex: "south-pines",
        },
        {
          id: "walk-uphill-along-the-fence",
          text: "Walk uphill along the fence",
          go_hex: "center-pines",
        },
      ],
    };

    expect(
      buildStoryChoices(beat, { place: "outdoors", hex: "south-pines" })
        .map((action) => action.label),
    ).toEqual(["Walk uphill along the fence"]);
  });

  it("filters current-hex story choices through the outdoor movement options", () => {
    const outdoor = { state: { currentId: "south-pines" } };
    const beat = {
      choices: [
        {
          id: "head-downhill-along-the-fence",
          text: "Head downhill along the fence",
          go_hex: "south-pines",
        },
      ],
    };

    expect(getMovementOptions(outdoor, beat)).toEqual([]);
  });
});
