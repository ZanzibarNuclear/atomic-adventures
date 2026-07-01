// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { createHydroState } from "../../lib/simulations/hydro/index.js";
import HydroConsoleView from "./HydroConsoleView.vue";

function gameState(hydro = {}) {
  return reactive({
    clock: { elapsedMinutes: 0 },
    facilities: {
      hydro: createHydroState(hydro),
    },
  });
}

describe("HydroConsoleView", () => {
  it("renders the hydro control-room panel telemetry", () => {
    const wrapper = mount(HydroConsoleView, {
      props: {
        gameState: gameState({
          online: true,
          intakeClear: true,
          intakeOpen: true,
          manualValves: {
            upstreamOpen: true,
            powerhouseOpen: true,
          },
          startupComplete: true,
          debrisFraction: 0,
        }),
        payload: {
          panelId: "hydro-control-room-panel",
          focus: "generation",
          mode: "startup",
        },
      },
    });

    expect(wrapper.text()).toContain("Generator console");
    expect(wrapper.text()).toContain("Online");
    expect(wrapper.text()).toContain("Output");
    expect(wrapper.text()).toContain("1.000 kW");
  });

  it("shows a validation error for unknown panel IDs", () => {
    const wrapper = mount(HydroConsoleView, {
      props: {
        gameState: gameState(),
        payload: { panelId: "missing-panel" },
      },
    });

    expect(wrapper.text()).toContain("Console unavailable");
    expect(wrapper.text()).toContain("Unknown panel ID: missing-panel");
  });

  it("emits return-to-map from the shared return control", async () => {
    const wrapper = mount(HydroConsoleView, {
      props: {
        gameState: gameState(),
        payload: { panelId: "hydro-control-room-panel" },
      },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("return-to-map")).toHaveLength(1);
  });
});
