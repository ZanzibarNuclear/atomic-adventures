import { computed, reactive, ref } from "vue";
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

  it("grants milestones and opens passages from authored story choices", () => {
    const place = ref("outdoors");
    const passageStates = {};
    const outdoor = reactive({
      state: {
        currentId: "gate-woods",
        previousId: null,
        mapTransition: null,
        transitionDirection: null,
      },
      setPassageOpen(id, open) {
        passageStates[id] = open;
        return true;
      },
    });
    const indoor = reactive({ indoor: { currentRoom: null, exteriorNode: null } });
    const gameState = reactive({
      playMode: "story",
      story: {
        activeArcId: "part-i-opener",
        activeBeatId: "open-compound-gate",
        enteredBeatIds: [],
        completedBeatIds: [],
        seenSceneIds: [],
      },
      flags: new Set(),
      milestones: {},
      facilities: {},
      lessons: {},
      clock: { day: 1, minuteOfDay: 900, elapsedMinutes: 420 },
      character: null,
    });
    const storyData = computed(() => normalizeStoryArcContent({
      storyArcs: [{
        id: "part-i-opener",
        startBeat: "open-compound-gate",
        beats: [
          {
            id: "open-compound-gate",
            completesWhen: { milestone: "gate-unlocked" },
            next: "walk-through-open-gate",
            scenes: [{
              id: "gate-vines-untangled",
              trigger: { place: "outdoors", hex: "gate-woods" },
              prose: "The vines are loose now.",
              choices: [{
                id: "open-the-gate",
                text: "Open the gate",
                openPassage: "compound-gate",
                grantMilestones: ["gate-unlocked"],
              }],
            }],
          },
          {
            id: "walk-through-open-gate",
            scenes: [{
              id: "gate-open",
              trigger: { place: "outdoors", hex: "gate-woods" },
              prose: "The gate stands open.",
            }],
          },
        ],
      }],
    }));

    const story = useStoryArc(storyData, { gameState, place, outdoor, indoor });

    expect(story.applyStoryAction("story:open-the-gate")).toBe(true);
    expect(passageStates["compound-gate"]).toBe(true);
    expect(gameState.milestones["gate-unlocked"]).toMatchObject({
      id: "gate-unlocked",
      day: 1,
      minuteOfDay: 900,
      elapsedMinutes: 420,
      source: "open-the-gate",
    });
    expect(gameState.story.completedBeatIds).toContain("open-compound-gate");
    expect(gameState.story.activeBeatId).toBe("walk-through-open-gate");
  });

  it("selects flag-specific scenes over default scenes after story choices set flags", () => {
    const place = ref("outdoors");
    const outdoor = reactive({
      state: {
        currentId: "gate-woods",
        previousId: null,
        mapTransition: null,
        transitionDirection: null,
      },
    });
    const indoor = reactive({ indoor: { currentRoom: null, exteriorNode: null } });
    const gameState = reactive({
      playMode: "story",
      story: {
        activeArcId: "part-i-opener",
        activeBeatId: "inspect-gate",
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
        id: "part-i-opener",
        startBeat: "inspect-gate",
        beats: [{
          id: "inspect-gate",
          completesWhen: { flag: "gate.vines-untangled" },
          scenes: [
            {
              id: "gate-first-look",
              trigger: { place: "outdoors", hex: "gate-woods" },
              prose: "A closed gate blocks the road.",
              choices: [{
                id: "inspect-the-gate",
                text: "Inspect the gate",
                set_flags: ["gate.inspected"],
              }],
            },
            {
              id: "gate-inspected",
              trigger: { place: "outdoors", hex: "gate-woods" },
              conditions: { flags: { all: ["gate.inspected"] } },
              prose: "The gate is only held by vines.",
            },
          ],
        }],
      }],
    }));

    const story = useStoryArc(storyData, { gameState, place, outdoor, indoor });

    expect(story.displayScene.value.id).toBe("gate-first-look");
    expect(story.applyStoryAction("story:inspect-the-gate")).toBe(true);
    expect(story.displayScene.value.id).toBe("gate-inspected");
  });

});
