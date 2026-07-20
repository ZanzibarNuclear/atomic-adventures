import { describe, expect, it } from "vitest";
import { normalizeStoryArcContent, selectSceneForBeat } from "./storyArcModel.js";

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

  it("honors conditions on scenes linked from authored prose", () => {
    const story = normalizeStoryArcContent({
      storyArcs: [{
        id: "gate", startBeat: "inspect", beats: [{ id: "inspect", scene: "gate", choices: [] }],
      }],
    }, {
      storyData: { beats: {
        gate: { trigger: { place: "outdoors", hex: "gate-woods" }, modes: ["story"], text: "Closed." },
        inspected: {
          storyBeat: "inspect", trigger: { place: "outdoors", hex: "gate-woods" }, modes: ["story"],
          conditions: { flags: { all: ["gate.inspected"] } }, text: "A vine holds the gate.",
        },
      } },
    });

    const beat = story.storyArcs[0].beats[0];
    expect(selectSceneForBeat(beat, {
      playMode: "story", location: { place: "outdoors", hex: "gate-woods" }, flags: new Set(["gate.inspected"]), milestones: {}, clock: null,
    })?.id).toBe("inspected");
  });
});
