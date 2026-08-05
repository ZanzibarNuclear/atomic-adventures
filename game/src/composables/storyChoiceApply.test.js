import { describe, expect, it } from "vitest";

/**
 * Mirrors GameView storyActionIdForChoice — ambient scenes often omit choice ids.
 */
function storyActionIdForChoice(choice, index) {
  if (choice?.id != null && choice.id !== "") return `story:${choice.id}`;
  return `story:${index}`;
}

describe("storyActionIdForChoice", () => {
  it("uses stable choice id when present", () => {
    expect(storyActionIdForChoice({ id: "abc-123", go_hex: "center-pines" }, 1)).toBe(
      "story:abc-123",
    );
  });

  it("falls back to index when ambient choices have no id (lower-stand thicket bug)", () => {
    const choices = [
      { text: "Head west", go_hex: "south-pines" },
      { text: "Head out of the thicket", go_hex: "center-pines" },
    ];
    expect(storyActionIdForChoice(choices[0], 0)).toBe("story:0");
    expect(storyActionIdForChoice(choices[1], 1)).toBe("story:1");
    // Previous bug: story:undefined — action never found
    expect(storyActionIdForChoice(choices[1], 1)).not.toBe("story:undefined");
  });
});
