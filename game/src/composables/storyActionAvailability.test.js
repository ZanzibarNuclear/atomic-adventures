import { describe, expect, it } from "vitest";
import { filterAllowedActions } from "./storyActionAvailability.js";

describe("story action availability", () => {
  it("treats local-map exits as ordinary movement in story mode", () => {
    const actions = [
      { id: "exit-world:garage-exit", label: "Travel world map" },
      { id: "door-open:garage-roll-up", label: "Open the garage door" },
    ];

    expect(filterAllowedActions(actions, { mode: "story", allowed: {} })).toEqual([
      actions[0],
    ]);
  });
});
