import { describe, expect, it } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { useStory } from "./useStory.js";
import { createCharacterState, markCharacterChanged } from "./useCharacterState.js";
import { addItem } from "../lib/character/holdings.js";

function harness(initialStory, {
  withCharacter = false,
  withClock = false,
  moveTo = () => {},
  openStageView = () => {},
} = {}) {
  const story = ref(initialStory);
  const place = ref("outdoors");
  const gameState = reactive({
    flags: new Set(),
    storySeen: new Set(),
    endCardDismissed: false,
    ...(withClock ? {
      clock: { elapsedMinutes: 0, minuteOfDay: 8 * 60, day: 1 },
    } : {}),
    ...(withCharacter ? {
      character: createCharacterState({
        items: [
          { id: "key", label: "Key", carrying: "unique", maxQuantity: 1 },
          { id: "tool", label: "Tool", carrying: "unique", maxQuantity: 1 },
        ],
        stats: [],
        knowledge: [],
        skills: [],
        quests: [],
        documents: [],
      }),
    } : {}),
  });
  const outdoor = {
    state: reactive({ currentId: "origin" }),
    canReachHex: () => true,
    moveTo,
    atBuildingEntrance: false,
  };
  const indoor = {
    indoor: reactive({ currentRoom: null, exteriorNode: null }),
    enterBuilding: () => {},
    moveToRoom: () => {},
  };
  return {
    story,
    gameState,
    outdoor,
    api: useStory(story, { gameState, place, outdoor, indoor, openStageView }),
  };
}

const beat = {
  heading: "Original",
  text: "Original text",
  trigger: { place: "outdoors", hex: "origin" },
  choices: [{ text: "Continue" }],
};

describe("useStory reactive content", () => {
  it("updates a pending beat in place when content changes", async () => {
    const { story, api } = harness({ beats: { intro: beat } });
    api.refreshNarrative();
    expect(api.pendingBeat.value.heading).toBe("Original");
    story.value = { beats: { intro: { ...beat, heading: "Edited", text: "Edited text" } } };
    await nextTick();
    expect(api.pendingBeat.value.heading).toBe("Edited");
    expect(api.pendingBeat.value.text).toBe("Edited text");
  });

  it("updates a pending beat when live content changes", async () => {
    const { story, api } = harness({ beats: { intro: beat } });
    api.refreshNarrative();
    story.value = {
      beats: {
        intro: {
          ...beat,
          heading: "Edited again",
        },
      },
    };
    await nextTick();
    expect(api.pendingBeat.value.heading).toBe("Edited again");
  });

  it("marks a beat seen when it is presented", () => {
    const passiveBeat = {
      ...beat,
      choices: [],
      revisit: "Return text",
    };
    const { api, gameState } = harness({ beats: { intro: passiveBeat } });

    api.refreshNarrative();

    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(gameState.storySeen.has("intro")).toBe(true);
  });

  it("shows revisit text and keeps choices after leaving and returning to a seen beat", async () => {
    const revisitBeat = {
      ...beat,
      choices: [{ text: "Try the trail again", go_hex: "east-pines" }],
      revisit: "Return text",
    };
    const { api, outdoor } = harness({ beats: { intro: revisitBeat } });

    api.refreshNarrative();
    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(api.pendingBeat.value.choices[0].text).toBe("Try the trail again");

    outdoor.state.currentId = "elsewhere";
    await nextTick();
    expect(api.narrativeBeat.value).toBeNull();

    outdoor.state.currentId = "origin";
    await nextTick();
    expect(api.narrativeBeat.value.text).toBe("Return text");
    expect(api.narrativeBeat.value.revisit).toBe(true);
    expect(api.pendingBeat.value.choices[0].text).toBe("Try the trail again");
  });

  it("shows story text again on return when no revisit text is defined", async () => {
    const { api, outdoor, gameState } = harness({ beats: { ambient: beat } });

    api.refreshNarrative();
    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(gameState.storySeen.has("ambient")).toBe(true);

    outdoor.state.currentId = "elsewhere";
    await nextTick();
    outdoor.state.currentId = "origin";
    await nextTick();

    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(api.narrativeBeat.value.revisit).toBe(false);
  });

  it("does not suppress a seen beat with choices", async () => {
    const choiceBeat = {
      ...beat,
      choices: [{ text: "Continue" }],
    };
    const { api, outdoor, gameState } = harness({ beats: { ambient: choiceBeat } });

    api.refreshNarrative();
    api.applyChoice(0);

    outdoor.state.currentId = "elsewhere";
    await nextTick();
    outdoor.state.currentId = "origin";
    await nextTick();

    expect(gameState.storySeen.has("ambient")).toBe(true);
    expect(api.pendingBeat.value.id).toBe("ambient");
    expect(api.pendingBeat.value.choices[0].text).toBe("Continue");
  });

  it("ignores legacy beat requirements", () => {
    const gatedBeat = {
      ...beat,
      require: { items: ["key"] },
      choices: [
        { text: "Continue" },
      ],
    };
    const { api } = harness({ beats: { gated: gatedBeat } }, {
      withCharacter: true,
    });

    api.refreshNarrative();
    expect(api.pendingBeat.value.id).toBe("gated");
    expect(api.pendingBeat.value.choices[0].disabled).toBeUndefined();
  });

  it("keeps a legacy required beat visible after character revision changes", async () => {
    const gatedBeat = {
      ...beat,
      require: { items: ["key"] },
    };
    const { api, gameState } = harness({ beats: { gated: gatedBeat } }, {
      withCharacter: true,
    });

    api.refreshNarrative();
    expect(api.pendingBeat.value.id).toBe("gated");

    addItem(gameState.character.holdings, gameState.character.definitions, "key");
    markCharacterChanged(gameState.character);
    await nextTick();

    expect(api.pendingBeat.value.id).toBe("gated");
  });

  it("commits choice flags before movement", () => {
    let flagSetDuringMove = false;
    const effectBeat = {
      ...beat,
      choices: [{
        text: "Set the flag and go",
        sets: ["story.flagged"],
        go_hex: "east-pines",
      }],
    };
    const setup = harness({ beats: { effect: effectBeat } }, {
      moveTo: () => {
        flagSetDuringMove = setup.gameState.flags.has("story.flagged");
      },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(flagSetDuringMove).toBe(true);
    expect(setup.gameState.storySeen.has("effect")).toBe(true);
  });

  it("advances choice time before movement", () => {
    let minutesDuringMove = 0;
    const effectBeat = {
      ...beat,
      choices: [{
        text: "Spend time and go",
        timeMinutes: 5,
        go_hex: "east-pines",
      }],
    };
    const setup = harness({ beats: { effect: effectBeat } }, {
      withClock: true,
      withCharacter: true,
      moveTo: () => {
        minutesDuringMove = setup.gameState.clock.elapsedMinutes;
      },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(minutesDuringMove).toBe(5);
    expect(setup.gameState.storySeen.has("effect")).toBe(true);
  });

  it("opens a stage view from a story choice without dismissing the beat", () => {
    const opened = [];
    const viewBeat = {
      ...beat,
      choices: [{
        text: "Check your inventory",
        view: { kind: "inventory" },
      }],
    };
    const setup = harness({ beats: { intro: viewBeat } }, {
      openStageView: (view) => opened.push(view),
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(opened).toEqual([{ kind: "inventory" }]);
    expect(setup.api.pendingBeat.value.id).toBe("intro");
    expect(setup.gameState.storySeen.has("intro")).toBe(true);
  });
});
