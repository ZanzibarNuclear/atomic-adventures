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

  function actionLabels(wrapper) {
    return wrapper.findAll("button.route-btn").map((button) => button.text());
  }

  async function chooseAction(wrapper, label) {
    const button = wrapper.findAll("button.route-btn")
      .find((candidate) => candidate.text() === label);
    expect(button, `Expected action button "${label}" to be visible`).toBeDefined();
    await button.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("renders playable story mode with usable scene actions", async () => {
    const wrapper = mount(GameView);

    await wrapper.get("button.recommended").trigger("click");

    expect(wrapper.text()).toContain("Objective");
    expect(wrapper.text()).toContain("Keep moving. Find something that can help you survive.");
    expect(wrapper.text()).toContain("Origin");
    expect(actionLabels(wrapper)).toContain("Go west");

    await chooseAction(wrapper, "Go west");

    expect(wrapper.text()).toContain("East Pines");
    wrapper.unmount();
  });

  it("renders playable open-world mode with usable scene actions", async () => {
    const wrapper = mount(GameView);

    await wrapper.findAll(".mode-choice-card")[1].trigger("click");

    expect(wrapper.text()).not.toContain("Objective");
    expect(wrapper.text()).toContain("Origin");
    expect(actionLabels(wrapper)).toContain("Go west");

    await chooseAction(wrapper, "Go west");

    expect(wrapper.text()).toContain("East Pines");
    wrapper.unmount();
  });

  it("keeps wellbeing warnings hidden until a play mode is active", async () => {
    const hydration = characterDefinitions.stats.find((stat) => stat.id === "hydration");
    const originalDefault = hydration.default;
    hydration.default = 20;
    const wrapper = mount(GameView);

    try {
      expect(wrapper.find(".wellbeing-alerts").exists()).toBe(false);

      await wrapper.get("button.recommended").trigger("click");

      expect(wrapper.find(".wellbeing-alerts").exists()).toBe(true);
      expect(wrapper.find(".wellbeing-alerts").text()).toContain("Dehydrated");
      expect(wrapper.find(".wellbeing-alerts").text()).not.toContain("Hydration:");
      expect(wrapper.find(".wellbeing-alerts").text()).toContain("Energized");
      expect(wrapper.find(".wellbeing-alerts").text()).toContain("Calm");
      const chips = wrapper.findAll(".wellbeing-chip");
      expect(chips.some((chip) => chip.text() === "Dehydrated" && chip.classes().includes("status-warning"))).toBe(true);
      expect(chips.some((chip) => chip.text() === "Energized" && chip.classes().includes("status-good"))).toBe(true);
      expect(chips.some((chip) => chip.text() === "Calm" && chip.classes().includes("status-good"))).toBe(true);
    } finally {
      hydration.default = originalDefault;
      wrapper.unmount();
    }
  });
});
