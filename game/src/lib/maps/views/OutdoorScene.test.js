// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import OutdoorScene from "./OutdoorScene.vue";

function buildOutdoor() {
  return {
    displayMapData: { hexes: [{ id: "origin", label: "Origin" }] },
    routeModels: [],
    featureModels: [],
    currentHexData: { id: "origin", label: "Origin" },
    state: {
      currentId: "origin",
      stand: { x: 0, y: 0 },
      discoveredOpenings: [],
    },
    discoveredList: ["origin"],
    passageMarkerStates: [],
    flags: new Set(),
    mode: "gameplay",
    standOverride: { hexId: "origin", standAt: { x: 0, y: 0 } },
    reachableHexIds: ["origin", "east-pines"],
    moves: [],
    directMoves: [],
    passageCrossings: [],
    lockedPassageActions: [],
    passageToggleActions: [],
    canReachHex: (hexId) => hexId === "east-pines",
    canSearchHere: () => false,
  };
}

describe("OutdoorScene play panel story choices", () => {
  it("renders reachable story choices as player actions and applies the clicked choice", async () => {
    const applyChoice = vi.fn();
    const wrapper = mount(OutdoorScene, {
      props: {
        outdoor: buildOutdoor(),
        indoor: {},
        pendingBeat: {
          choices: [
            { text: "Study the sealed controls", disabled: true },
            { text: "Continue east", go_hex: "east-pines" },
            { text: "Head west", go_hex: "blocked-west" },
          ],
        },
        applyChoice,
        travelToHex: vi.fn(),
        enterBuilding: vi.fn(),
      },
      global: {
        stubs: {
          HexMap: { template: "<div />" },
        },
      },
    });

    const buttons = wrapper.findAll("button.route-btn")
      .filter((button) => !button.text().startsWith("Check "));
    expect(buttons.map((button) => button.text())).toEqual(["Continue east", "Head west"]);

    await buttons[0].trigger("click");

    expect(applyChoice).toHaveBeenCalledWith(1);
    wrapper.unmount();
  });
});
