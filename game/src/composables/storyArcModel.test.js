import { describe, expect, it } from "vitest";
import { selectSceneForBeat } from "./storyArcModel.js";

describe("story arc time gates", () => {
  it("honors a sleep flag for an after-milestone scene gate", () => {
    const scene = selectSceneForBeat({
      scenes: [{
        id: "day-two-library",
        trigger: { place: "indoors", room: "library" },
        time: { days: [2], afterMilestone: "library.sleep-1" },
        prose: "Day two begins.",
      }],
    }, {
      playMode: "story",
      location: { place: "indoors", room: "library" },
      clock: { day: 2, minuteOfDay: 420, elapsedMinutes: 1860 },
      milestones: {},
      flags: new Set(["library.sleep-1"]),
    });

    expect(scene?.id).toBe("day-two-library");
  });
});
