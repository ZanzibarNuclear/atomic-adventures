/* @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StoryBeatEditor from "./StoryBeatEditor.vue";
import StoryChoiceEditor from "./StoryChoiceEditor.vue";

function mountEditor() {
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
      },
      catalog: { world: { hexes: [], rooms: [], exteriorNodes: [] } },
      destinationType: () => "",
      flagIds: ["story.gate.inspected", "story.gate.untangled"],
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
});
