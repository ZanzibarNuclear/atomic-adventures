// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick, ref } from "vue";
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
    document.body.innerHTML = "";
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

    expect(wrapper.text()).not.toContain("Objective");
    expect(wrapper.text()).not.toContain("Keep moving. Find something that can help you survive.");
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

  it("opens wellbeing warnings from the Check Vitals button after play starts", async () => {
    const hydration = characterDefinitions.stats.find((stat) => stat.id === "hydration");
    const originalDefault = hydration.default;
    hydration.default = 20;
    const wrapper = mount(GameView);

    try {
      expect(wrapper.find(".wellbeing-alerts").exists()).toBe(false);

      await wrapper.get("button.recommended").trigger("click");

      expect(wrapper.find(".wellbeing-alerts").exists()).toBe(false);
      const checkVitals = wrapper.findAll("button")
        .find((button) => button.text() === "Check Vitals");
      expect(checkVitals).toBeDefined();
      expect(wrapper.find(".play-panel").text()).toContain("Check Vitals");
      expect(wrapper.find(".play-panel").text()).toContain("Check Inventory");

      await checkVitals.trigger("click");
      await nextTick();

      const dialog = document.body.querySelector(".vitals-dialog");
      const alertBar = document.body.querySelector(".wellbeing-alerts");
      expect(dialog).toBeTruthy();
      expect(alertBar).toBeTruthy();
      expect(alertBar.textContent).toContain("Dehydrated");
      expect(alertBar.textContent).not.toContain("Hydration:");
      expect(alertBar.textContent).toContain("Energized");
      expect(alertBar.textContent).toContain("Calm");
      const chips = [...document.body.querySelectorAll(".wellbeing-chip")];
      expect(chips.some((chip) => chip.textContent === "Dehydrated" && chip.classList.contains("status-warning"))).toBe(true);
      expect(chips.some((chip) => chip.textContent === "Energized" && chip.classList.contains("status-good"))).toBe(true);
      expect(chips.some((chip) => chip.textContent === "Calm" && chip.classList.contains("status-good"))).toBe(true);
    } finally {
      hydration.default = originalDefault;
      wrapper.unmount();
    }
  });

  it("opens carried inventory from the Check Inventory button", async () => {
    const wrapper = mount(GameView);

    try {
      await wrapper.get("button.recommended").trigger("click");

      const checkInventory = wrapper.findAll("button")
        .find((button) => button.text() === "Check Inventory");
      expect(checkInventory).toBeDefined();

      await checkInventory.trigger("click");
      await nextTick();

      const dialog = document.body.querySelector(".inventory-dialog");
      expect(dialog).toBeTruthy();
      expect(dialog.textContent).toContain("Carried items");
      expect(dialog.textContent).toContain("field backpack");
      expect(dialog.textContent).not.toContain("hydro startup instruction card");
    } finally {
      wrapper.unmount();
    }
  });
});
