import { describe, expect, it } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { useStory } from "./useStory.js";
import { createCharacterState } from "./useCharacterState.js";
import { addItem, itemQuantity } from "../lib/character/holdings.js";

function harness(initialStory, { withCharacter = false, moveTo = () => {} } = {}) {
  const story = ref(initialStory);
  const place = ref("outdoors");
  const gameState = reactive({
    flags: new Set(),
    storySeen: new Set(),
    endCardDismissed: false,
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
    state: reactive({ currentId: "trailhead" }),
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
    api: useStory(story, { gameState, place, outdoor, indoor }),
  };
}

const beat = {
  once: true,
  heading: "Original",
  text: "Original text",
  trigger: { place: "outdoors", hex: "trailhead" },
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

  it("removes an ineligible pending beat and selects a newly eligible beat", async () => {
    const { story, api } = harness({ beats: { intro: beat } });
    api.refreshNarrative();
    story.value = {
      beats: {
        replacement: {
          ...beat,
          heading: "Replacement",
        },
        intro: {
          ...beat,
          require: { all: ["missing.flag"] },
        },
      },
    };
    await nextTick();
    expect(api.pendingBeat.value.id).toBe("replacement");
  });

  it("marks a one-time no-acknowledgement beat seen when it is presented", () => {
    const passiveBeat = {
      ...beat,
      acknowledge: false,
      choices: [],
      revisit: "Return text",
    };
    const { api, gameState } = harness({ beats: { intro: passiveBeat } });

    api.refreshNarrative();

    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(gameState.storySeen.has("intro")).toBe(true);
  });

  it("shows revisit text after leaving and returning to a seen no-acknowledgement beat", async () => {
    const passiveBeat = {
      ...beat,
      acknowledge: false,
      choices: [],
      revisit: "Return text",
    };
    const { api, outdoor } = harness({ beats: { intro: passiveBeat } });

    api.refreshNarrative();
    expect(api.narrativeBeat.value.text).toBe("Original text");

    outdoor.state.currentId = "elsewhere";
    await nextTick();
    expect(api.narrativeBeat.value).toBeNull();

    outdoor.state.currentId = "trailhead";
    await nextTick();
    expect(api.narrativeBeat.value.text).toBe("Return text");
    expect(api.narrativeBeat.value.revisit).toBe(true);
  });

  it("does not mark repeatable no-acknowledgement beats seen", () => {
    const repeatableBeat = {
      ...beat,
      once: false,
      acknowledge: false,
      choices: [],
      revisit: "Unused revisit text",
    };
    const { api, gameState } = harness({ beats: { ambient: repeatableBeat } });

    api.refreshNarrative();

    expect(api.narrativeBeat.value.text).toBe("Original text");
    expect(gameState.storySeen.has("ambient")).toBe(false);
  });

  it("does not store repeatable choice beats in seen state", () => {
    const repeatableBeat = {
      ...beat,
      once: false,
    };
    const { api, gameState } = harness({ beats: { ambient: repeatableBeat } });

    api.refreshNarrative();
    api.applyChoice(0);

    expect(gameState.storySeen.has("ambient")).toBe(false);
  });

  it("uses character requirements for beats and choices", () => {
    const gatedBeat = {
      ...beat,
      require: { items: ["key"] },
      choices: [
        { text: "Use the tool", require: { items: ["tool"] } },
      ],
    };
    const { api, gameState } = harness({ beats: { gated: gatedBeat } }, {
      withCharacter: true,
    });

    api.refreshNarrative();
    expect(api.pendingBeat.value).toBeNull();

    addItem(gameState.character.holdings, gameState.character.definitions, "key");
    api.refreshNarrative();
    expect(api.pendingBeat.value.id).toBe("gated");
    expect(api.pendingBeat.value.choices[0].disabled).toBe(true);
  });

  it("commits effects before movement", () => {
    let heldDuringMove = false;
    const effectBeat = {
      ...beat,
      choices: [{
        text: "Take the key and go",
        effects: [{ op: "item.add", id: "key" }],
        go_hex: "east-pines",
      }],
    };
    const setup = harness({ beats: { effect: effectBeat } }, {
      withCharacter: true,
      moveTo: () => {
        heldDuringMove = itemQuantity(setup.gameState.character.holdings, "key") === 1;
      },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(heldDuringMove).toBe(true);
    expect(setup.gameState.storySeen.has("effect")).toBe(true);
  });

  it("does not move or consume the beat when an atomic effect fails", () => {
    let moved = false;
    const effectBeat = {
      ...beat,
      choices: [{
        text: "Spend a missing key",
        effects: [{ op: "item.remove", id: "key" }],
        go_hex: "east-pines",
      }],
    };
    const setup = harness({ beats: { effect: effectBeat } }, {
      withCharacter: true,
      moveTo: () => { moved = true; },
    });

    setup.api.refreshNarrative();
    setup.api.applyChoice(0);

    expect(moved).toBe(false);
    expect(setup.api.pendingBeat.value.id).toBe("effect");
    expect(setup.gameState.storySeen.has("effect")).toBe(false);
  });
});
