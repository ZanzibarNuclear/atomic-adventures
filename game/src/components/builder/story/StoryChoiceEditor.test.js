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

  it("lets the author pick known flags when editing set-flags", async () => {
    const wrapper = mountEditor([
      "story.gate.inspected",
      "story.gate.untangled",
    ]);

    await wrapper.get('button[aria-label="Edit choice"]').trigger("click");
    const flagEditor = wrapper.findComponent({ name: "FlagListEditor" });
    expect(flagEditor.exists()).toBe(true);
    expect(flagEditor.props("flagIds")).toEqual([
      "story.gate.inspected",
      "story.gate.untangled",
    ]);

    // Already-selected flags show as chips, not as picker options.
    expect(flagEditor.text()).toContain("story.gate.inspected");
    const optionValues = flagEditor.findAll("select option").map((option) => option.element.value);
    expect(optionValues).not.toContain("story.gate.inspected");
    expect(optionValues).toContain("story.gate.untangled");

    // Write-in field is available for new flag ids.
    expect(flagEditor.find('input[aria-label="Write in a flag id"]').exists()).toBe(true);
  });

  it("adds a known flag from the picker and a write-in flag", async () => {
    const wrapper = mountEditor([
      "story.gate.inspected",
      "story.gate.untangled",
    ]);

    await wrapper.get('button[aria-label="Edit choice"]').trigger("click");
    const flagEditor = wrapper.findComponent({ name: "FlagListEditor" });

    await flagEditor.get('select[aria-label="Choose a known flag"]').setValue("story.gate.untangled");
    await flagEditor.findAll("button.sm").find((btn) => btn.text().includes("Add")).trigger("click");
    expect(wrapper.props("choice").set_flags).toEqual([
      "story.gate.inspected",
      "story.gate.untangled",
    ]);

    const writeIn = flagEditor.get('input[aria-label="Write in a flag id"]');
    await writeIn.setValue("story.gate.opened");
    const addButtons = flagEditor.findAll("button.sm").filter((btn) => btn.text().includes("Add"));
    await addButtons[addButtons.length - 1].trigger("click");
    expect(wrapper.props("choice").set_flags).toEqual([
      "story.gate.inspected",
      "story.gate.untangled",
      "story.gate.opened",
    ]);
  });
});
