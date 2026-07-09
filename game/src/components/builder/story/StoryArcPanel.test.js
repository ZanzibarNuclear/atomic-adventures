/* @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import StoryArcPanel from "./StoryArcPanel.vue";

const hiddenRuntimeFields = {
  choices: [{ id: "continue", label: "Continue" }],
  allowed: {
    movement: { mode: "unrestricted", hexes: ["center-pines"], rooms: [], exteriorNodes: [], transitions: [] },
    storyForwardActions: ["move-hex:center-pines"], optionalActions: [], storyChoices: [], stageViews: [],
    indoorActions: [], outdoorActions: [], itemActions: [], developerActions: [],
  },
  completesWhen: { location: { place: "outdoors", hex: "center-pines" } },
  onEnter: { setFlags: ["story.entered"] },
  onComplete: { timeMinutes: 5 },
};

const documentText = JSON.stringify({
  storyArcs: [{
    id: "part-i",
    title: "Part I",
    startBeat: "reach-the-gate",
    beats: [{
      id: "reach-the-gate",
      title: "Reach the gate",
      scene: "center-pines",
      ...hiddenRuntimeFields,
      next: null,
      nextArc: null,
    }],
  }],
}, null, 2);

const beats = [
  { id: "center-pines", storyBeat: "reach-the-gate", heading: "The fence line", text: "The fence starts here.", trigger: { place: "outdoors", hex: "center-pines" } },
  { id: "south-pines", storyBeat: "reach-the-gate", heading: "Blocking the way", text: "The fence continues downhill.", trigger: { place: "outdoors", hex: "south-pines" } },
];

function mountPanel() {
  return mount(StoryArcPanel, {
    props: {
      documentText,
      beats,
      catalog: { world: { hexes: [{ id: "center-pines", label: "Center Pines" }, { id: "south-pines", label: "South Pines" }], rooms: [], exteriorNodes: [] } },
    },
  });
}

async function selectBeat(wrapper) {
  await wrapper.find(".beat-select").trigger("click");
}

describe("StoryArcPanel focused authoring", () => {
  it("selects an arc without automatically opening its first beat", () => {
    const wrapper = mountPanel();

    expect(wrapper.text()).toContain("Starting beat");
    expect(wrapper.text()).not.toContain("Linked content");
  });

  it("opens linked scenes without mutating the story arc document", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);
    const sceneButtons = wrapper.findAll(".scene-select");

    await sceneButtons[1].trigger("click");

    expect(wrapper.emitted("select-scene")?.[0]?.[0].sceneId).toBe("south-pines");
    expect(wrapper.emitted("update:documentText")).toBeUndefined();
  });

  it("does not render runtime-policy or JSON editor cards", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);

    expect(wrapper.text()).not.toContain("Movement references");
    expect(wrapper.text()).not.toContain("Authored actions and views");
    expect(wrapper.text()).not.toContain("Completion condition");
    expect(wrapper.text()).not.toContain("Beat effects");
    expect(wrapper.text()).not.toContain("Active beat preview");
    expect(wrapper.text()).not.toContain("Document JSON");
  });

  it("preserves hidden runtime fields when editing a beat title", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);
    await wrapper.find(".detail-actions button").trigger("click");
    await wrapper.find(".title-editor input").setValue("A better title");
    await wrapper.find(".title-editor").trigger("submit");

    const update = JSON.parse(wrapper.emitted("update:documentText")[0][0]);
    const updatedBeat = update.storyArcs[0].beats[0];
    expect(updatedBeat.title).toBe("A better title");
    for (const [key, value] of Object.entries(hiddenRuntimeFields)) expect(updatedBeat[key]).toEqual(value);
  });

  it("protects an in-progress title edit when selection changes", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);
    await wrapper.find(".detail-actions button").trigger("click");
    await wrapper.find(".title-editor input").setValue("Unsaved title");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    await wrapper.find(".outline-select").trigger("click");

    expect(confirm).toHaveBeenCalled();
    expect(wrapper.find(".title-editor input").element.value).toBe("Unsaved title");
    confirm.mockRestore();
  });

  it("emits an atomic split request with hidden fields retained on the original beat", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);
    const split = wrapper.findAll(".detail-actions button").find((button) => button.text() === "Split scenes");
    await split.trigger("click");
    await wrapper.find(".dialog").trigger("submit");

    const payload = wrapper.emitted("split-beat")[0][0];
    const original = payload.storyArcDocument.storyArcs[0].beats[0];
    const created = payload.storyArcDocument.storyArcs[0].beats[1];
    expect(payload.sceneIds).toEqual(["south-pines"]);
    for (const [key, value] of Object.entries(hiddenRuntimeFields)) expect(original[key]).toEqual(value);
    expect(created).toMatchObject({ scene: "south-pines", completesWhen: null, onEnter: null, onComplete: null });
  });
});
