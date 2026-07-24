/* @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StoryBeatEditor from "./StoryBeatEditor.vue";
import StoryChoiceEditor from "./StoryChoiceEditor.vue";

function mountEditor(overrides = {}) {
  return mount(StoryBeatEditor, {
    props: {
      draft: {
        id: "the-gate",
        version: 1,
        once: true,
        eyebrow: "",
        heading: "A Guardhouse and a Gate",
        text: "A gate blocks the way.",
        revisit: "",
        modes: ["story"],
        storyBeat: null,
        trigger: { place: "outdoors", hex: "gate-woods" },
        match: { originHex: [], mapTransition: null, transitionDirection: null },
        conditions: { flags: { all: [], not: [] } },
        time: { days: [] },
        choices: [{
          id: "inspect-gate",
          text: "Inspect the gate",
          set_flags: ["story.gate.inspected"],
          timeMinutes: 0,
          timeUntil: null,
          activity: "light",
        }],
        ...(overrides.draft ?? {}),
      },
      catalog: { world: { hexes: [], rooms: [], exteriorNodes: [] } },
      destinationType: () => "",
      flagIds: ["story.gate.inspected", "story.gate.untangled"],
      storyBeatOptions: [
        {
          id: "reach-the-gate",
          label: "Reach the gate (reach-the-gate)",
          arcTitle: "Part I Opener",
        },
        {
          id: "inspect-intake",
          label: "Inspect the intake (inspect-intake)",
          arcTitle: "Part I Opener",
        },
      ],
      ...overrides.props,
    },
  });
}

describe("StoryBeatEditor choices", () => {
  it("passes authored flag IDs to choice editors", async () => {
    const wrapper = mountEditor();

    const choicesTab = wrapper.findAll('[role="tab"]')
      .find((button) => button.text() === "Choices");
    await choicesTab.trigger("click");

    expect(wrapper.getComponent(StoryChoiceEditor).props("flagIds"))
      .toEqual(["story.gate.inspected", "story.gate.untangled"]);
  });

  it("lists story-arc beats in the story beat picker", async () => {
    const wrapper = mountEditor();
    const select = wrapper.find('select[value=""], select');
    // Mode section select for story beat
    const storyBeatSelect = wrapper.findAll("select").find((el) => {
      const options = el.findAll("option").map((option) => option.element.value);
      return options.includes("reach-the-gate");
    });
    expect(storyBeatSelect).toBeTruthy();
    const labels = storyBeatSelect.findAll("option").map((option) => option.text());
    expect(labels).toContain("None (optional)");
    expect(labels).toContain("Reach the gate (reach-the-gate)");
    expect(labels).toContain("Inspect the intake (inspect-intake)");

    await storyBeatSelect.setValue("reach-the-gate");
    expect(wrapper.props("draft").storyBeat).toBe("reach-the-gate");
  });
});
