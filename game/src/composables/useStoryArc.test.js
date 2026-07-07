import { describe, expect, it } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { createGameState, setPlayMode } from "./useGameState.js";
import { normalizeStoryArcContent } from "./storyArcModel.js";
import { useStoryArc } from "./useStoryArc.js";
import { mapData, utilityData } from "../lib/testing/content.js";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import storyArcContent from "../../public/content/story-arcs.json";

function storyDocument(overrides = {}) {
  return {
    storyArcs: [
      {
        id: "part-i-opener",
        title: "Part I Opener",
        startBeat: "intro",
        beats: [
          {
            id: "intro",
            title: "Get oriented",
            scenes: [
              {
                id: "intro-start",
                trigger: { place: "outdoors", hex: "origin" },
                prose: "Zanzibar gets his bearings.",
              },
              {
                id: "intro-east",
                trigger: { place: "outdoors", hex: "east-pines" },
                prose: "The fence line comes into view.",
              },
            ],
            choices: [{ id: "walk-east", label: "Walk east", go_hex: "east-pines" }],
            authoredActions: [{ id: "move-hex:east-pines", kind: "move", role: "story" }],
            onEnter: { setFlags: ["story.intro.entered"] },
            completesWhen: { flag: "story.intro.complete" },
            next: "read-card",
          },
          {
            id: "read-card",
            title: "Read the card",
            scenes: [{
              id: "card",
              trigger: { place: "outdoors", hex: "east-pines" },
              prose: "There is a card here.",
            }],
            completesWhen: { milestone: "card.read" },
            next: null,
          },
        ],
        ...overrides,
      },
    ],
  };
}

function harness(story = storyDocument(), start = { activeArcId: "part-i-opener", activeBeatId: "intro" }) {
  const place = ref("outdoors");
  const gameState = createGameState({ mapData, buildingData: utilityData });
  const outdoor = useOutdoorWorld(mapData, gameState);
  outdoor.state.currentId = "origin";
  const indoor = {
    indoor: reactive({ currentRoom: null, exteriorNode: null }),
    moveToRoom: (room) => {
      indoor.indoor.currentRoom = room;
      indoor.indoor.exteriorNode = null;
    },
    moveToExteriorNode: (node) => {
      indoor.indoor.currentRoom = null;
      indoor.indoor.exteriorNode = node;
    },
  };
  const openedViews = [];
  setPlayMode(gameState, "story", start);
  const api = useStoryArc(ref(story), {
    gameState,
    place,
    outdoor,
    indoor,
    openStageView: (view) => {
      openedViews.push(view);
      return true;
    },
  });
  return { api, gameState, place, outdoor, indoor, openedViews };
}

describe("useStoryArc", () => {
  it("resolves the active arc, beat, scene, and story actions", () => {
    const setup = harness();

    expect(setup.api.storyError.value).toBe("");
    expect(setup.api.activeArc.value.id).toBe("part-i-opener");
    expect(setup.api.activeBeat.value.id).toBe("intro");
    expect(setup.api.activeScene.value.id).toBe("intro-start");
    expect(setup.api.storyActions.value.map((action) => action.id)).toEqual([
      "story:walk-east",
      "move-hex:east-pines",
    ]);
  });

  it("applies beat enter effects once", async () => {
    const setup = harness();
    setup.api.tick();
    setup.api.tick();
    await nextTick();

    expect(setup.gameState.flags.has("story.intro.entered")).toBe(true);
    expect(setup.gameState.story.enteredBeatIds).toEqual(["intro"]);
  });

  it("keeps ordinary movement from advancing the beat until completion is met", async () => {
    const setup = harness();

    setup.outdoor.state.currentId = "east-pines";
    setup.api.tick();
    await nextTick();

    expect(setup.api.activeBeat.value.id).toBe("intro");
    expect(setup.api.activeScene.value.id).toBe("intro-east");

    setup.gameState.flags.add("story.intro.complete");
    setup.api.tick();
    await nextTick();

    expect(setup.api.activeBeat.value.id).toBe("read-card");
    expect(setup.gameState.story.completedBeatIds).toContain("intro");
  });

  it("advances through nextArc handoff", async () => {
    const setup = harness(storyDocument({
      beats: [{
        id: "intro",
        scenes: [{ id: "intro", trigger: { place: "outdoors", hex: "origin" }, prose: "Start." }],
        completesWhen: { flag: "done" },
        nextArc: "part-i-station",
      }],
    }).storyArcs[0] ? {
      storyArcs: [
        storyDocument({
          beats: [{
            id: "intro",
            scenes: [{ id: "intro", trigger: { place: "outdoors", hex: "origin" }, prose: "Start." }],
            completesWhen: { flag: "done" },
            nextArc: "part-i-station",
          }],
        }).storyArcs[0],
        {
          id: "part-i-station",
          title: "Part I Station",
          startBeat: "shelter",
          beats: [{ id: "shelter", scenes: [], completesWhen: { flag: "sheltered" } }],
        },
      ],
    } : null);

    setup.gameState.flags.add("done");
    setup.api.tick();
    await nextTick();

    expect(setup.api.activeArc.value.id).toBe("part-i-station");
    expect(setup.api.activeBeat.value.id).toBe("shelter");
  });

  it("applies choices through existing movement and flag boundaries", async () => {
    const setup = harness();
    expect(setup.api.applyStoryAction("story:walk-east")).toBe(true);
    await nextTick();

    expect(setup.outdoor.state.currentId).toBe("east-pines");
  });

  it("passes current Part I content through the normalized story arc model", () => {
    const normalized = normalizeStoryArcContent(storyArcContent.story);
    const setup = harness(normalized, {
      activeArcId: "part-i-opener",
      activeBeatId: "survive-in-the-woods",
    });

    expect(setup.api.activeArc.value.id).toBe("part-i-opener");
    expect(setup.api.activeBeat.value.id).toBe("survive-in-the-woods");
    expect(setup.api.activeBeat.value.scenes[0].id).toBe("intro");
  });
});
