// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { createGameState, applySnapshot, captureSnapshot } from "../../../composables/useGameState.js";
import { useIndoorBuilding } from "../composables/useIndoorBuilding.js";
import { useOutdoorWorld } from "../composables/useOutdoorWorld.js";
import { getDoorState } from "../composables/useDoors.js";
import characterContent from "../../../../public/content/character.json";
import worldContent from "../../../../public/content/world.json";
import utilityStationContent from "../../../../public/content/utility-station.json";
import HydroConsoleView from "../../../components/game-views/HydroConsoleView.vue";

const characterDefinitions = characterContent.character;
const mapData = worldContent.world;
const utilityData = utilityStationContent.building;

function buildHarness() {
  const place = ref("indoors");
  const builderView = ref(false);
  const gameState = createGameState({
    mapData,
    buildingData: utilityData,
    characterData: characterDefinitions,
  });
  const outdoor = useOutdoorWorld(mapData, gameState);
  const indoor = useIndoorBuilding(utilityData, outdoor, {
    place,
    builderView,
    gameState,
  });
  return { gameState, outdoor, indoor, place };
}

function setIndoorLocation(indoor, { room = null, exteriorNode = null }) {
  indoor.indoor.currentRoom = room;
  indoor.indoor.currentStand = null;
  indoor.indoor.exteriorNode = exteriorNode;
}

describe("hydro alpha startup path", () => {
  it("connects authored field actions to hydro state, save/load, console telemetry, and station power", async () => {
    const harness = buildHarness();
    const { gameState, indoor, outdoor, place } = harness;
    const rollDoorBefore = getDoorState(indoor.indoor.doorState, "utility-station", "large-bay-roll");
    expect(rollDoorBefore.locked).toBe(true);

    setIndoorLocation(indoor, { room: "control-room" });
    indoor.performAction("read-micro-hydro-ops");
    setIndoorLocation(indoor, { exteriorNode: "upstream-bank" });
    indoor.performAction("clear-intake-debris");
    setIndoorLocation(indoor, { exteriorNode: "midstream-bank" });
    indoor.performAction("align-pipeflow");
    setIndoorLocation(indoor, { exteriorNode: "downstream-bank" });
    indoor.performAction("open-turbine-valve");
    setIndoorLocation(indoor, { room: "control-room" });
    indoor.performAction("connect-power");

    expect(gameState.facilities.hydro).toMatchObject({
      intakeClear: true,
      intakeOpen: true,
      debrisFraction: 0,
      manualValves: {
        upstreamOpen: true,
        powerhouseOpen: true,
      },
      startupComplete: true,
      online: true,
    });
    expect(indoor.powerOn).toBe(true);
    expect(getDoorState(indoor.indoor.doorState, "utility-station", "large-bay-roll").locked).toBe(false);
    expect(gameState.facilities.hydro.eventLog.map((event) => event.label)).toEqual([
      "Intake cleared and opened",
      "Upstream manual valve opened",
      "Powerhouse manual valve opened",
      "Hydro generator startup completed",
    ]);
    expect(gameState.facilities.hydro.eventLog.map((event) => event.elapsedMinutes)).toEqual([
      75,
      105,
      125,
      140,
    ]);

    const consoleView = mount(HydroConsoleView, {
      props: {
        gameState,
        payload: { panelId: "hydro-control-room-panel" },
      },
    });
    expect(consoleView.text()).toContain("Online");
    expect(consoleView.text()).toContain("1.000 kW");
    expect(consoleView.text()).not.toContain("Next field action");
    consoleView.unmount();

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor });
    const loaded = buildHarness();

    expect(applySnapshot(snapshot, loaded)).toBe(true);
    expect(loaded.gameState.facilities.hydro.online).toBe(true);
    expect(loaded.gameState.facilities.hydro.manualValves.powerhouseOpen).toBe(true);
    expect(loaded.indoor.indoor.facility.hydroOnline).toBe(true);
  });
});
