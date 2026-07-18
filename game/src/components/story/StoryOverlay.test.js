/* @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import StoryOverlay from "./StoryOverlay.vue";

describe("StoryOverlay", () => {
  it("renders the card from a completed story arc", () => {
    const wrapper = mount(StoryOverlay, {
      props: {
        completion: {
          id: "part-i-opener",
          completion: {
            card: {
              eyebrow: "Through the Gate",
              heading: "Welcome to the restricted area",
              description: "The next part of the adventure begins.",
              note: "Leaving the gate open?",
              actionLabel: "Continue",
            },
          },
        },
      },
    });

    expect(wrapper.get('[role="dialog"]').text()).toContain("Welcome to the restricted area");
  });
});
