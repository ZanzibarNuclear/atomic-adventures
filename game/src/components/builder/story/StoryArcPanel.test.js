/* @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StoryArcPanel from "./StoryArcPanel.vue";

const documentText = JSON.stringify({
  storyArcs: [{
    id: "part-i",
    title: "Part I",
    startBeat: "reach-the-gate",
    beats: [{
      id: "reach-the-gate",
      title: "Reach the gate",
      scene: "center-pines",
      allowed: {
        movement: { hexes: [], rooms: [], exteriorNodes: [], transitions: [] },
        storyForwardActions: [],
        optionalActions: [],
      },
      completesWhen: null,
      onEnter: null,
      onComplete: null,
      next: null,
      nextArc: null,
    }],
  }],
}, null, 2);

const beats = [
  {
    id: "center-pines",
    storyBeat: "reach-the-gate",
    heading: "The fence line",
    text: "The fence starts here.",
    trigger: { place: "outdoors", hex: "center-pines" },
  },
  {
    id: "south-pines",
    storyBeat: "reach-the-gate",
    heading: "Blocking the way",
    text: "The fence continues downhill.",
    trigger: { place: "outdoors", hex: "south-pines" },
  },
];

function mountPanel() {
  return mount(StoryArcPanel, {
    props: {
      documentText,
      beats,
      catalog: {
        world: {
          hexes: [
            { id: "center-pines", label: "Center Pines" },
            { id: "south-pines", label: "South Pines" },
          ],
          rooms: [],
          exteriorNodes: [],
          mapTransitions: [],
        },
        character: { documents: [], items: [] },
        learning: { lessons: [] },
      },
    },
  });
}

describe("StoryArcPanel scene selection", () => {
  it("previews a linked scene without mutating the story arc document", async () => {
    const wrapper = mountPanel();
    const sceneButtons = wrapper.findAll(".scene-select");

    await sceneButtons[1].trigger("click");

    expect(wrapper.emitted("select-scene")).toBeTruthy();
    expect(wrapper.emitted("update:documentText")).toBeUndefined();
    expect(wrapper.text()).toContain("The fence continues downhill.");
  });

  it("only updates the document when making a linked scene primary", async () => {
    const wrapper = mountPanel();
    const makePrimaryButtons = wrapper.findAll(".scene-row-actions button")
      .filter((button) => button.text() === "Make primary");

    await makePrimaryButtons[1].trigger("click");

    const updates = wrapper.emitted("update:documentText");
    expect(updates).toHaveLength(1);
    expect(JSON.parse(updates[0][0]).storyArcs[0].beats[0].scene).toBe("south-pines");
  });
});
