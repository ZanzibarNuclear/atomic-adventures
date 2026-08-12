/* @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StoryChoiceEditor from "./StoryChoiceEditor.vue";

function mountEditor(flagIds = []) {
  return mount(StoryChoiceEditor, {
    props: {
      choice: {
        id: "inspect-gate",
        text: "Inspect the gate",
        set_flags: ["story.gate.inspected"],
        timeMinutes: 0,
        timeUntil: null,
        activity: "light",
      },
      index: 0,
      catalog: { world: { hexes: [], rooms: [], exteriorNodes: [] } },
      destinationType: () => "",
      flagIds,
    },
  });
}

describe("StoryChoiceEditor flags", () => {
  it("shows a compact summary with the choice label by default", () => {
    const wrapper = mountEditor(["story.gate.inspected"]);

    expect(wrapper.get(".choice-title").text()).toBe("Inspect the gate");
    expect(wrapper.text()).toContain("Flag");
    expect(wrapper.text()).toContain("story.gate.inspected");
    expect(wrapper.find(".choice-form").exists()).toBe(false);
  });

  it("shows all defined flags in the browser tree when editing", async () => {
    const wrapper = mountEditor([
      "story.gate.inspected",
      "story.gate.untangled",
    ]);

    await wrapper.get('button[aria-label="Edit choice"]').trigger("click");
    await wrapper.get(".flag-browser button").trigger("click");

    expect(wrapper.text()).not.toContain("No flags defined yet.");
    expect(wrapper.text()).toContain("inspected");
    expect(wrapper.text()).toContain("untangled");
  });
});
