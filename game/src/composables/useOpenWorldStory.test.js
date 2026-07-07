import { describe, expect, it } from "vitest";
import { reactive, ref } from "vue";
import { createGameState, setPlayMode } from "./useGameState.js";
import { useOpenWorldStory } from "./useOpenWorldStory.js";
import { mapData, utilityData } from "../lib/testing/content.js";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";

function harness() {
  const place = ref("outdoors");
  const gameState = createGameState({ mapData, buildingData: utilityData });
  setPlayMode(gameState, "open-world");
  const outdoor = useOutdoorWorld(mapData, gameState);
  outdoor.state.currentId = "origin";
  const indoor = {
    indoor: reactive({ currentRoom: null, exteriorNode: null }),
    enterBuilding: () => {},
    moveToRoom: (room) => {
      indoor.indoor.currentRoom = room;
    },
  };
  const storyData = ref({
    beats: {
      storyOnly: {
        trigger: { place: "outdoors", hex: "origin" },
        modes: ["story"],
        text: "Canonical Zanzibar prose.",
      },
      ambient: {
        trigger: { place: "outdoors", hex: "origin" },
        modes: ["open-world"],
        text: "The forest slope starts here.",
        choices: [{ text: "Walk east", go_hex: "east-pines" }],
      },
    },
  });
  const api = useOpenWorldStory(storyData, { gameState, place, outdoor, indoor });
  return { api, gameState, outdoor };
}

describe("useOpenWorldStory", () => {
  it("selects ambient open-world scenes without canonical story progression", () => {
    const setup = harness();

    expect(setup.api.activeScene.value.id).toBe("ambient");
    expect(setup.api.activeScene.value.text).toBe("The forest slope starts here.");
    expect(setup.gameState.story).toBeNull();
  });

  it("applies ordinary ambient choices through world movement", () => {
    const setup = harness();

    expect(setup.api.applyChoice(0)).toBe(true);
    expect(setup.outdoor.state.currentId).toBe("east-pines");
  });
});
