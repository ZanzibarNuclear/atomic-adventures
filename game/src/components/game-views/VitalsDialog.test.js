// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import VitalsDialog from "./VitalsDialog.vue";

describe("VitalsDialog", () => {
  it("shows each vital's current value within its authored range", () => {
    const wrapper = mount(VitalsDialog, {
      props: {
        vitals: [{
          id: "hydration",
          label: "Hydration",
          value: 35,
          min: 10,
          max: 90,
          state: "Thirsty",
          tone: "warning",
        }],
      },
      global: {
        stubs: { Teleport: true },
      },
    });

    const range = wrapper.get('[role="progressbar"]');
    expect(wrapper.text()).toContain("Hydration");
    expect(wrapper.text()).toContain("35");
    expect(wrapper.text()).toContain("10");
    expect(wrapper.text()).toContain("90");
    expect(range.attributes()).toMatchObject({
      "aria-valuemin": "10",
      "aria-valuemax": "90",
      "aria-valuenow": "35",
    });
  });
});
