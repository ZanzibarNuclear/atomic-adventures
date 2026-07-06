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
        }],
      },
    });

    await wrapper.get("input[type='checkbox']").setValue(true);
    expect(wrapper.emitted("set-station-power")?.[0]).toEqual([true]);

    await wrapper.get("input[type='range']").setValue(25);
    expect(wrapper.emitted("set-vital")?.[0]).toEqual([{ id: "satiety", value: 25 }]);

    await wrapper.findAll("button").find((button) => button.text() === "+10").trigger("click");
    expect(wrapper.emitted("adjust-vital")?.[0]).toEqual([{ id: "satiety", delta: 10 }]);

    await wrapper.findAll("button").find((button) => button.text() === "Full").trigger("click");
    expect(wrapper.emitted("set-vital")?.at(-1)).toEqual([{ id: "satiety", value: 100 }]);
  });
});
