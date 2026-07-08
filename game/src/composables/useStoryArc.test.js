import { computed, nextTick, reactive, ref } from "vue";
import { describe, expect, it } from "vitest";
import { normalizeStoryArcContent } from "./storyArcModel.js";
import { useStoryArc } from "./useStoryArc.js";

function labels(actions) {
  return actions.map((action) => action.label);
}

describe("story arc visible actions", () => {
  it("rebuilds story choices from the current scene when the avatar changes location", () => {
    const place = ref("outdoors");
    const outdoor = reactive({
      state: {
        currentId: "center-pines",
        previousId: null,
        mapTransition: null,
        transitionDirection: null,
      },
    });
    const indoor = reactive({ indoor: { currentRoom: null, exteriorNode: null } });
    const gameState = reactive({
      playMode: "story",
      story: {
        activeArcId: "part-i",
        activeBeatId: "reach-the-gate",
        enteredBeatIds: [],
        completedBeatIds: [],
        seenSceneIds: [],
      },
      flags: new Set(),
      milestones: {},
      facilities: {},
      lessons: {},
      clock: null,
      character: null,
    });
    const storyData = computed(() => normalizeStoryArcContent({
      storyArcs: [{
        id: "part-i",
        startBeat: "reach-the-gate",
        beats: [{
          id: "reach-the-gate",
          scene: "center-pines",
          choices: [{
            id: "head-downhill-along-the-fence",
            text: "Head downhill along the fence",
            go_hex: "south-pines",
          }],
          scenes: [
            {
              id: "center-pines",
              trigger: { place: "outdoors", hex: "center-pines" },
              prose: "The fence starts here.",
            },
            {
              id: "south-pines",
              trigger: { place: "outdoors", hex: "south-pines" },
              prose: "The lower fence line.",
              choices: [{
                id: "walk-uphill-along-the-fence",
                text: "Walk uphill along the fence",
                go_hex: "center-pines",
              }],
            },
          ],
        }],
      }],
    }));

    const story = useStoryArc(storyData, { gameState, place, outdoor, indoor });

    expect(labels(story.storyActions.value)).toContain("Head downhill along the fence");

    outdoor.state.previousId = "center-pines";
    outdoor.state.currentId = "south-pines";

    expect(labels(story.storyActions.value)).toEqual(["Walk uphill along the fence"]);

    outdoor.state.previousId = "south-pines";
    outdoor.state.currentId = "unscened-woods";

    expect(labels(story.storyActions.value)).toEqual([]);
  });

  it("recovers forward when noncanonical travel reaches a later story location", async () => {
    const place = ref("outdoors");
    const outdoor = reactive({
      state: {
        currentId: "far-pines",
        previousId: "east-pines",
        mapTransition: null,
        transitionDirection: null,
      },
    });
    const indoor = reactive({ indoor: { currentRoom: null, exteriorNode: null } });
    const gameState = reactive({
      playMode: "story",
      story: {
        activeArcId: "part-i",
        activeBeatId: "keep-moving-west",
        enteredBeatIds: [],
        completedBeatIds: [],
        seenSceneIds: [],
      },
      flags: new Set(),
      milestones: {},
      facilities: {},
      lessons: {},
      clock: null,
      character: null,
    });
    const storyData = computed(() => normalizeStoryArcContent({
      storyArcs: [{
        id: "part-i",
        startBeat: "keep-moving-west",
        beats: [
          {
            id: "keep-moving-west",
            scene: "east-pines",
            completesWhen: { location: { place: "outdoors", hex: "center-pines" } },
            next: "reach-the-gate",
            scenes: [{
              id: "east-pines",
              trigger: { place: "outdoors", hex: "east-pines" },
              prose: "Keep moving west.",
            }],
          },
          {
            id: "far-pines",
            scene: "far-pines",
            completesWhen: { location: { place: "outdoors", hex: ["north-bend", "center-pines"] } },
            next: "reach-the-gate",
            scenes: [{
              id: "far-pines",
              trigger: { place: "outdoors", hex: "far-pines" },
              prose: "You climbed uphill.",
            }],
          },
          {
            id: "reach-the-gate",
            scene: "north-bend",
            completesWhen: { location: { place: "outdoors", hex: ["gate-woods", "utility-yard"] } },
            next: "find-a-way-past-fence",
            scenes: [{
              id: "north-bend",
              trigger: { place: "outdoors", hex: "north-bend" },
              prose: "The fence bends toward a gate.",
            }],
          },
          {
            id: "find-a-way-past-fence",
            scene: "the-gate",
            scenes: [{
              id: "the-gate",
              trigger: { place: "outdoors", hex: "gate-woods" },
              prose: "The compound gate blocks the road.",
            }],
          },
        ],
      }],
    }));

    const story = useStoryArc(storyData, { gameState, place, outdoor, indoor });
    await nextTick();

    expect(gameState.story.activeBeatId).toBe("far-pines");
    expect(story.activeScene.value?.id).toBe("far-pines");

    outdoor.state.previousId = "north-bend";
    outdoor.state.currentId = "gate-woods";
    await nextTick();

    expect(gameState.story.activeBeatId).toBe("find-a-way-past-fence");
    expect(story.activeScene.value?.id).toBe("the-gate");
  });
});
