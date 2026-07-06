// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import GameView from "./GameView.vue";
import { storylineSeed } from "../../server/storyline-seed.js";
import characterContent from "../../public/content/character.json";
import worldContent from "../../public/content/world.json";
import utilityStationContent from "../../public/content/utility-station.json";

const emptyRefresh = vi.fn(() => Promise.resolve(true));
const mapData = worldContent.world;
const utilityData = utilityStationContent.building;
const characterDefinitions = characterContent.character;

vi.mock("../composables/useStoryContent.js", () => ({
  useStoryContent: () => ({
    storyData: computed(() => ({ beats: {} })),
    error: ref(""),
    refresh: emptyRefresh,
  }),
}));

vi.mock("../composables/useWorldContent.js", () => ({
  useWorldContent: () => ({
    worldData: computed(() => mapData),
    error: ref(""),
    refresh: emptyRefresh,
  }),
}));

vi.mock("../composables/useBuildingContent.js", () => ({
  useBuildingContent: () => ({
    buildingData: computed(() => utilityData),
    error: ref(""),
    refresh: emptyRefresh,
  }),
}));

vi.mock("../composables/useCharacterContent.js", () => ({
  useCharacterContent: () => ({
    characterData: computed(() => characterDefinitions),
    error: ref(""),
    refresh: emptyRefresh,
  }),
}));

vi.mock("../composables/useLearningContent.js", () => ({
  useLearningContent: () => ({
    lessons: computed(() => []),
    error: ref(""),
    refresh: emptyRefresh,
  }),
}));

vi.mock("../composables/useStorylineContent.js", () => ({
  useStorylineContent: () => ({
    storylineData: computed(() => storylineSeed),
    error: ref(""),
    refresh: emptyRefresh,
  }),
}));

describe("GameView play mode entry", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the playable scene after choosing storyline mode", async () => {
    const wrapper = mount(GameView);

    await wrapper.get("button.recommended").trigger("click");

    expect(wrapper.text()).toContain("Objective");
    expect(wrapper.text()).toContain("Enter the utility station control room.");
    expect(wrapper.text()).toContain("Origin");
    expect(wrapper.findComponent({ name: "OutdoorScene" }).exists()).toBe(true);
    wrapper.unmount();
  });

  it("renders the playable scene after choosing open-world mode", async () => {
    const wrapper = mount(GameView);

    await wrapper.findAll(".mode-choice-card")[1].trigger("click");

    expect(wrapper.text()).not.toContain("Objective");
    expect(wrapper.text()).toContain("Origin");
    expect(wrapper.findComponent({ name: "OutdoorScene" }).exists()).toBe(true);
    wrapper.unmount();
  });
});
