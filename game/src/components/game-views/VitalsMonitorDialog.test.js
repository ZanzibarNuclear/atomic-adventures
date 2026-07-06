// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import VitalsMonitorDialog from "./VitalsMonitorDialog.vue";
import { createGameClock } from "../../lib/character/gameTime.js";

function overview(value = 48) {
  return {
    vitals: [
      {
        id: "hydration",
        label: "Hydration",
        value,
        min: 0,
        max: 100,
        state: value <= 35 ? "Thirsty" : "Okay",
        tone: value <= 35 ? "warning" : "positive",
        description: "Water reserve.",
      },
    ],
    conditions: [],
  };
}

describe("VitalsMonitorDialog", () => {
  it("renders current game-time vitals and updates while open", async () => {
    const wrapper = mount(VitalsMonitorDialog, {
      props: {
        overview: overview(),
        clock: createGameClock(),
      },
    });

    expect(wrapper.text()).toContain("Day 1 · 12:00 PM");
    expect(wrapper.text()).toContain("Okay · 48 / 100");
    expect(wrapper.find(".floating-layer").exists()).toBe(true);
    expect(wrapper.find(".modal-backdrop").exists()).toBe(false);
    expect(wrapper.get("[role='dialog']").attributes("aria-modal")).toBe("false");
    expect(wrapper.find(".game-time + .vitals-strip").exists()).toBe(true);

    await wrapper.setProps({
      overview: overview(34),
      clock: createGameClock({ elapsedMinutes: 90, minuteOfDay: 810, day: 1 }),
    });

    expect(wrapper.text()).toContain("Day 1 · 1:30 PM");
    expect(wrapper.text()).toContain("Thirsty · 34 / 100");
    expect(wrapper.find(".vital-card.warning").exists()).toBe(true);
  });
});
