import { describe, expect, it } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { useStory } from "./useStory.js";

function harness(initialStory) {
  const story = ref(initialStory);
  const place = ref("outdoors");
  const gameState = reactive({
    flags: new Set(),
    storySeen: new Set(),
    endCardDismissed: false,
  });
  const outdoor = {
    state: reactive({ currentId: "trailhead" }),
    canReachHex: () => true,
    moveTo: () => {},
    atBuildingEntrance: false,
  };
  const indoor = {
    indoor: reactive({ currentRoom: null, exteriorNode: null }),
    enterBuilding: () => {},
    moveToRoom: () => {},
  };
  return {
    story,
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
});
