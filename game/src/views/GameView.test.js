// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick, ref } from "vue";
import GameView from "./GameView.vue";
import { storyArcSeed } from "../../server/story-arc-seed.js";
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

vi.mock("../composables/useStoryArcContent.js", () => ({
  useStoryArcContent: () => ({
    storyArcDocument: computed(() => storyArcSeed),
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

  it("opens carried inventory from the Inventory header button", async () => {
    const wrapper = mount(GameView);

    try {
      await wrapper.get("button.recommended").trigger("click");

      const inventory = wrapper.findAll("button")
        .find((button) => button.text() === "Inventory");
      expect(inventory).toBeDefined();

      await inventory.trigger("click");
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
