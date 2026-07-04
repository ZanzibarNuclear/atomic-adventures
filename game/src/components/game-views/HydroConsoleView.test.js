// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { createHydroEvent, createHydroState } from "../../lib/simulations/hydro/index.js";
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
  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(wrapper.text()).toContain("Pressure");
    expect(wrapper.text()).toContain("Turbine");
    expect(wrapper.text()).toContain("1.000 kW");
    expect(wrapper.text()).not.toContain("Flow");
    expect(wrapper.text()).not.toContain("Net head");
    expect(wrapper.text()).not.toContain("Last report");
    expect(wrapper.text()).not.toContain("Recent events");
    wrapper.unmount();
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
    wrapper.unmount();
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
    wrapper.unmount();
  });

  it("samples live telemetry while mounted and renders transient graph lines", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
    const state = gameState({
      online: true,
      intakeClear: true,
      intakeOpen: true,
      manualValves: {
        upstreamOpen: true,
        powerhouseOpen: true,
      },
      startupComplete: true,
      debrisFraction: 0,
    });
    state.clock.elapsedMinutes = 240;
    const before = JSON.stringify(state.facilities.hydro);

    const wrapper = mount(HydroConsoleView, {
      props: {
        gameState: state,
        payload: { panelId: "hydro-control-room-panel" },
      },
    });
    await nextTick();

    expect(wrapper.text()).toContain("Live monitor");
    expect(wrapper.text()).toContain("240 min");
    expect(wrapper.findAll("polyline")).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(2000);
    await nextTick();

    expect(wrapper.text()).toContain("242 min");
    expect(wrapper.find("polyline").attributes("points")?.split(" ").length).toBeGreaterThan(3);
    expect(JSON.stringify(state.facilities.hydro)).toBe(before);
    wrapper.unmount();
  });

  it("reopens with generated history as graph marker lines without report clutter", async () => {
    const state = gameState({
      lastCheckpointElapsedMinutes: 20,
      eventLog: [
        createHydroEvent({
          eventId: "hydro-event-0005-intake",
          elapsedMinutes: 5,
          type: "facility-change",
          label: "Intake debris cleared",
          payload: {
            actionId: "clear-intake-debris",
            patch: { intakeClear: true, debrisFraction: 0 },
          },
        }),
        createHydroEvent({
          eventId: "hydro-event-0008-intake-open",
          elapsedMinutes: 8,
          type: "facility-change",
          label: "Intake opened",
          payload: {
            actionId: "open-intake",
            patch: { intakeOpen: true },
          },
        }),
        createHydroEvent({
          eventId: "hydro-event-0010-upstream",
          elapsedMinutes: 10,
          type: "facility-change",
          label: "Upstream manual valve opened",
          payload: {
            actionId: "align-pipeflow",
            patch: { manualValves: { upstreamOpen: true } },
          },
        }),
        createHydroEvent({
          eventId: "hydro-event-0015-powerhouse",
          elapsedMinutes: 15,
          type: "facility-change",
          label: "Powerhouse manual valve opened",
          payload: {
            actionId: "open-turbine-valve",
            patch: { manualValves: { powerhouseOpen: true } },
          },
        }),
        createHydroEvent({
          eventId: "hydro-event-0020-online",
          elapsedMinutes: 20,
          type: "state-transition",
          label: "Hydro generator startup completed",
          payload: {
            actionId: "connect-power",
            patch: { startupComplete: true, online: true, lastCheckpointElapsedMinutes: 20 },
          },
        }),
      ],
    });
    state.clock.elapsedMinutes = 35;

    const wrapper = mount(HydroConsoleView, {
      props: {
        gameState: state,
        payload: { panelId: "hydro-control-room-panel" },
      },
    });
    await nextTick();

    expect(wrapper.findAll(".event-marker-line").length).toBeGreaterThan(0);
    expect(wrapper.find("polyline").attributes("points")?.split(" ").length).toBeGreaterThan(1);
    expect(wrapper.text()).not.toContain("Last report");
    expect(wrapper.text()).not.toContain("Recent events");
    expect(wrapper.text()).not.toContain("Generated energy");
    wrapper.unmount();
  });

  it("diagnoses missing station power when field work is ready but offline", () => {
    const wrapper = mount(HydroConsoleView, {
      props: {
        gameState: gameState({
          intakeClear: true,
          intakeOpen: true,
          manualValves: {
            upstreamOpen: true,
            powerhouseOpen: true,
          },
          startupComplete: true,
          debrisFraction: 0,
        }),
        payload: { panelId: "hydro-control-room-panel" },
      },
    });

    expect(wrapper.text()).toContain("Ready");
    expect(wrapper.text()).toContain("Station power is offline.");
    wrapper.unmount();
  });

  it("offers guided map return for missing field prerequisites", async () => {
    const wrapper = mount(HydroConsoleView, {
      props: {
        gameState: gameState(),
        payload: { panelId: "hydro-control-room-panel" },
      },
    });

    expect(wrapper.text()).toContain("Next action");
    expect(wrapper.text()).toContain("Return to the upstream bank");
    expect(wrapper.text()).toContain("Use the ordinary field action to clear debris from the intake.");

    const buttons = wrapper.findAll("button");
    await buttons.find((button) => button.text() === "Return to map").trigger("click");

    expect(wrapper.emitted("return-to-map")).toHaveLength(1);
    wrapper.unmount();
  });
});
