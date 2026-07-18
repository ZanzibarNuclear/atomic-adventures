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
    }],
  }],
}, null, 2);

const beats = [
  { id: "center-pines", storyBeat: "reach-the-gate", heading: "The fence line", text: "The fence starts here.", trigger: { place: "outdoors", hex: "center-pines" } },
  { id: "south-pines", storyBeat: "reach-the-gate", heading: "Blocking the way", text: "The fence continues downhill.", trigger: { place: "outdoors", hex: "south-pines" } },
  { id: "unlinked-scene", storyBeat: null, heading: "An unused scene", text: "Waiting to be attached.", trigger: { place: "outdoors", hex: "south-pines" } },
  { id: "library-draft", storyBeat: null, heading: "Library draft", text: "A library scene.", trigger: { place: "indoors", room: "library" } },
  { id: "attached-library", storyBeat: "another-beat", heading: "Attached library scene", text: "Already linked elsewhere.", trigger: { place: "indoors", room: "library" } },
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

    expect(wrapper.find(".metadata").text()).toBe("IDpart-i");
    expect(wrapper.text()).not.toContain("Linked content");
  });

  it("edits the completion transition listed after an arc's final beat", async () => {
    const source = JSON.parse(documentText);
    source.storyArcs.push({
      id: "part-ii",
      title: "Part II",
      startBeat: "arrival",
      beats: [{ ...source.storyArcs[0].beats[0], id: "arrival", scene: null, next: null }],
    });
    const wrapper = mount(StoryArcPanel, { props: { documentText: JSON.stringify(source), beats, catalog: {} } });

    await wrapper.findAll(".completion-select")[0].trigger("click");
    await wrapper.find(".detail-actions button").trigger("click");
    await wrapper.find(".completion-editor select").setValue("part-ii");
    await wrapper.find(".completion-editor button").trigger("click");
    const inputs = wrapper.findAll(".completion-editor input");
    await inputs[0].setValue("Day 1 complete");
    await inputs[1].setValue("Shelter at last");
    await wrapper.find(".completion-editor textarea").setValue("A quiet night in the library.");
    await inputs[2].setValue("More tomorrow.");
    await inputs[3].setValue("Continue");
    await wrapper.find(".completion-editor").trigger("submit");

    const update = JSON.parse(wrapper.emitted("update:documentText")[0][0]);
    expect(update.storyArcs[0].completion).toEqual({
      nextArc: "part-ii",
      card: {
        eyebrow: "Day 1 complete",
        heading: "Shelter at last",
        description: "A quiet night in the library.",
        note: "More tomorrow.",
        actionLabel: "Continue",
      },
    });
  });

  it("previews the transition card before editing", async () => {
    const source = JSON.parse(documentText);
    source.storyArcs[0].completion = {
      nextArc: "part-ii",
      card: {
        eyebrow: "Day 1 complete",
        heading: "Shelter at last",
        description: "A quiet night in the library.",
        note: "More tomorrow.",
        actionLabel: "Continue",
      },
    };
    const wrapper = mount(StoryArcPanel, { props: { documentText: JSON.stringify(source), beats, catalog: {} } });

    await wrapper.find(".completion-select").trigger("click");

    const preview = wrapper.find(".completion-preview");
    expect(preview.text()).toContain("Day 1 complete");
    expect(preview.text()).toContain("Shelter at last");
    expect(preview.text()).toContain("A quiet night in the library.");
    expect(preview.text()).toContain("More tomorrow.");
    expect(preview.text()).toContain("Continue");
    expect(wrapper.text()).not.toContain("Next story arc");
    expect(wrapper.text()).not.toContain("Add a card only when the player should pause");
  });

  it("edits an arc ID and label while updating arc handoff references", async () => {
    const source = JSON.parse(documentText);
    source.storyArcs.push({
      id: "part-ii",
      title: "Part II",
      startBeat: "arrival",
      completion: { nextArc: "part-i" },
      beats: [{ ...source.storyArcs[0].beats[0], id: "arrival", scene: null }],
    });
    const wrapper = mount(StoryArcPanel, { props: { documentText: JSON.stringify(source), beats, catalog: {} } });
    await wrapper.find(".detail-actions button").trigger("click");

    await wrapper.find(".arc-id-input").setValue("opening-arc");
    await wrapper.find(".title-editor input:not(.arc-id-input)").setValue("Opening Arc");
    await wrapper.find(".title-editor").trigger("submit");

    const update = JSON.parse(wrapper.emitted("update:documentText")[0][0]);
    expect(update.storyArcs[0]).toMatchObject({ id: "opening-arc", title: "Opening Arc" });
    expect(update.storyArcs[1].completion.nextArc).toBe("opening-arc");
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

  it("keeps beat details to the ID and linked scenes", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);

    const metadata = wrapper.find(".metadata").text();
    expect(metadata).toContain("ID");
    expect(metadata).not.toContain("Stable ID");
    expect(metadata).not.toContain("Arc");
    expect(metadata).not.toContain("Position");
    expect(metadata).not.toContain("Previous");
    expect(metadata).not.toContain("Next");
    expect(wrapper.findAll(".detail-actions button").map((button) => button.text())).toEqual([
      "Edit title", "Move beat", "Split beat", "Attach scene", "Add scene", "Delete beat",
    ]);
  });

  it("attaches an existing scene through a picker", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);
    const attach = wrapper.findAll(".detail-actions button").find((button) => button.text() === "Attach scene");
    await attach.trigger("click");
    await wrapper.find(".attach-scene-select").setValue("unlinked-scene");
    await wrapper.find(".dialog").trigger("submit");

    expect(wrapper.emitted("attach-scene")?.[0]?.[0]).toMatchObject({
      arcId: "part-i",
      beatId: "reach-the-gate",
      sceneId: "unlinked-scene",
    });
  });

  it("filters attachable scenes by room and unattached state", async () => {
    const wrapper = mountPanel();
    await selectBeat(wrapper);
    const attach = wrapper.findAll(".detail-actions button").find((button) => button.text() === "Attach scene");
    await attach.trigger("click");
    await wrapper.find(".attach-room-filter").setValue("library");

    const sceneOptions = () => wrapper.find(".attach-scene-select").findAll("option")
      .map((option) => option.element.value);
    expect(sceneOptions()).toEqual(["library-draft"]);

    await wrapper.find(".attach-unattached-filter input").setValue(false);
    expect(sceneOptions()).toEqual(["library-draft", "attached-library"]);
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
    const split = wrapper.findAll(".detail-actions button").find((button) => button.text() === "Split beat");
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
