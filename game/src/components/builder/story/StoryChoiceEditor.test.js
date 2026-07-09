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
  it("shows all defined flags in the browser tree", async () => {
    const wrapper = mountEditor([
      "story.gate.inspected",
      "story.gate.untangled",
    ]);

    await wrapper.get(".flag-browser button").trigger("click");

    expect(wrapper.text()).not.toContain("No flags defined yet.");
    expect(wrapper.text()).toContain("inspected");
    expect(wrapper.text()).toContain("untangled");
  });
});
