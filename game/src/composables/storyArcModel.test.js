import { describe, expect, it } from "vitest";
import {
  normalizeStoryArcContent,
  selectSceneForBeat,
} from "./storyArcModel.js";

describe("story arc normalization", () => {
  it("hydrates canonical story arcs and beats with matching scenes", () => {
    const normalized = normalizeStoryArcContent({
      id: "story-main",
      storyArcs: [
        {
          id: "part-i-opener",
          title: "Part I Opener",
          defaultMode: "story",
          startBeat: "survive",
          beats: [
            {
              id: "survive",
              title: "Keep moving.",
              scene: "opening-scene",
              allowed: {
                storyForwardActions: ["move-hex:east-pines"],
                optionalActions: ["stage:inventory"],
                itemActions: ["water-bottle.drink"],
              },
              completesWhen: { location: { place: "outdoors", hex: "east-pines" } },
              nextArc: "part-i-station",
            },
          ],
        },
      ],
    }, {
      storyData: {
        beats: {
          "opening-scene": {
            eyebrow: "Day 1",
            heading: "Lost",
            trigger: { place: "outdoors", hex: "start" },
            modes: ["story"],
            text: "Zanzibar keeps moving.",
            revisit: "The pines are familiar now.",
            choices: [{ text: "Follow the slope", go_hex: "east-pines" }],
          },
        },
      },
    });

    expect(normalized.storyArcs).toHaveLength(1);
    expect(normalized.storyArcs[0]).toMatchObject({
      id: "part-i-opener",
      title: "Part I Opener",
      startBeat: "survive",
    });
    expect(normalized.storyArcs[0].beats[0]).toMatchObject({
      id: "survive",
      title: "Keep moving.",
      completesWhen: { location: { place: "outdoors", hex: "east-pines" } },
      nextArc: "part-i-station",
    });
    expect(normalized.storyArcs[0].beats[0].scenes[0]).toMatchObject({
      id: "opening-scene",
      prose: "Zanzibar keeps moving.",
      revisitProse: "The pines are familiar now.",
      trigger: { place: "outdoors", hex: "start" },
    });
    expect(normalized.storyArcs[0].beats[0].choices[0]).toMatchObject({
      id: "follow-the-slope",
      label: "Follow the slope",
      go_hex: "east-pines",
    });
    expect(normalized.storyArcs[0].beats[0].authoredActions.map((action) => action.id)).toEqual([
      "move-hex:east-pines",
      "stage:inventory",
      "item-action:water-bottle.drink",
    ]);
  });

  it("accepts the new storyArcs shape without requiring old terminology", () => {
    const normalized = normalizeStoryArcContent({
      id: "story-main",
      storyArcs: [{
        id: "part-i-opener",
        title: "Part I Opener",
        startBeat: "lost",
        beats: [{
          id: "lost",
          title: "Lost",
          scenes: [{
            id: "lost-pines",
            trigger: { place: "outdoors", hex: "start" },
            prose: "The forest leans close.",
          }],
          choices: [{ id: "walk", label: "Walk" }],
          authoredActions: [{ id: "move-hex:east-pines", kind: "move", role: "story" }],
          completesWhen: { flag: "story.started" },
          next: "gate",
        }],
      }],
    });

    expect(normalized.storyArcs[0].beats[0]).toMatchObject({
      id: "lost",
      scenes: [{ id: "lost-pines", prose: "The forest leans close." }],
      choices: [{ id: "walk", label: "Walk" }],
      next: "gate",
    });
  });

  it("handles missing arcs, missing beats, missing scenes, and stale next references", () => {
    expect(normalizeStoryArcContent({ storyArcs: [] }).storyArcs).toEqual([]);

    const normalized = normalizeStoryArcContent({
      storyArcs: [{
        id: "part-i-opener",
        startBeat: "missing",
        beats: [{
          id: "intro",
          scene: "missing-prose",
          next: "deleted-beat",
          nextArc: "deleted-arc",
        }],
      }],
    });

    const arc = normalized.storyArcs[0];
    expect(arc.startBeat).toBe("missing");
    expect(arc.beats[0].scenes).toEqual([]);
    expect(arc.beats[0].next).toBe("deleted-beat");
    expect(arc.beats[0].nextArc).toBe("deleted-arc");
  });
});

describe("selectSceneForBeat", () => {
  it("prefers action-specific scenes over default scenes", () => {
    const beat = {
      scenes: [
        {
          id: "default-yard",
          trigger: { place: "outdoors", hex: "utility-yard" },
          prose: "The yard is quiet.",
        },
        {
          id: "from-flats",
          trigger: { place: "outdoors", hex: "utility-yard" },
          match: { originHex: "the-flats" },
          prose: "The riverbank path drops into the yard.",
        },
      ],
    };

    const scene = selectSceneForBeat(beat, {
      playMode: "story",
      location: {
        place: "outdoors",
        hex: "utility-yard",
        originHex: "the-flats",
      },
    });

    expect(scene.id).toBe("from-flats");
  });

  it("returns null when no scene matches the active beat and location", () => {
    const scene = selectSceneForBeat({
      scenes: [{
        id: "elsewhere",
        trigger: { place: "outdoors", hex: "east-pines" },
        prose: "Not here.",
      }],
    }, {
      playMode: "story",
      location: { place: "outdoors", hex: "utility-yard" },
    });

    expect(scene).toBeNull();
  });

  it("uses milestones for temporal scene criteria", () => {
    const beat = {
      scenes: [
        {
          id: "before-power",
          trigger: { place: "indoors", room: "control-room" },
          time: { beforeMilestone: "hydro.online" },
          prose: "Everything is quiet.",
        },
        {
          id: "after-power",
          trigger: { place: "indoors", room: "control-room" },
          time: { afterMilestone: "hydro.online" },
          prose: "The console hums.",
        },
      ],
    };

    const scene = selectSceneForBeat(beat, {
      playMode: "story",
      milestones: { "hydro.online": true },
      clock: { day: 1, minuteOfDay: 600, elapsedMinutes: 120 },
      location: { place: "indoors", room: "control-room" },
    });

    expect(scene.id).toBe("after-power");
  });
});
