// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DeveloperSettingsDialog from "./DeveloperSettingsDialog.vue";

describe("DeveloperSettingsDialog", () => {
  it("emits facility and vital override changes", async () => {
    const wrapper = mount(DeveloperSettingsDialog, {
      props: {
        stationPowerOn: false,
        vitals: [{
          id: "satiety",
          label: "Satiety",
          value: 58,
          min: 0,
          max: 100,
          displayStates: [
            { at: 90, state: "Stuffed", tone: "positive" },
            { at: 55, state: "Full", tone: "positive" },
            { at: 40, state: "Peckish", tone: "warning" },
            { at: 10, state: "Hungry", tone: "warning" },
            { at: 0, state: "Starving", tone: "error" },
          ],
        }],
      },
    });

    await wrapper.get("input[type='checkbox']").setValue(true);
    expect(wrapper.emitted("set-station-power")?.[0]).toEqual([true]);

    await wrapper.get("input[type='range']").setValue(25);
    expect(wrapper.emitted("set-vital")?.[0]).toEqual([{ id: "satiety", value: 25 }]);

    const fed = wrapper.findAll("button").find((button) => button.text() === "Full");
    const hungry = wrapper.findAll("button").find((button) => button.text() === "Hungry");
    expect(fed.attributes("aria-pressed")).toBe("true");
    expect(hungry.attributes("aria-pressed")).toBe("false");

    await wrapper.setProps({
      vitals: [{
        id: "satiety",
        label: "Satiety",
        value: 37,
        min: 0,
        max: 100,
        displayStates: [
          { at: 90, state: "Stuffed", tone: "positive" },
          { at: 55, state: "Full", tone: "positive" },
          { at: 40, state: "Peckish", tone: "warning" },
          { at: 10, state: "Hungry", tone: "warning" },
          { at: 0, state: "Starving", tone: "error" },
        ],
      }],
    });
    expect(wrapper.findAll("button").find((button) => button.text() === "Full").attributes("aria-pressed")).toBe("false");
    expect(wrapper.findAll("button").find((button) => button.text() === "Hungry").attributes("aria-pressed")).toBe("true");

    await wrapper.findAll("button").find((button) => button.text() === "Hungry").trigger("click");
    expect(wrapper.emitted("set-vital")?.at(-1)).toEqual([{ id: "satiety", value: 25 }]);
  });
});
