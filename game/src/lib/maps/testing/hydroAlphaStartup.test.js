// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { createGameState, applySnapshot, captureSnapshot } from "../../../composables/useGameState.js";
import {
  buildIndoorPlayActions,
  handleIndoorPlayAction,
} from "../../../composables/usePlayPanel.js";
import { useIndoorBuilding } from "../composables/useIndoorBuilding.js";
import { useOutdoorWorld } from "../composables/useOutdoorWorld.js";
import { getDoorState } from "../composables/useDoors.js";
import {
  characterHolderId,
  itemQuantity,
} from "../../../lib/character/holdings.js";
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
  it("connects food, water purification, and rest to the first survival crisis", () => {
    const { gameState, indoor } = buildHarness();
    gameState.flags.add("story.the-garage");
    setIndoorLocation(indoor, { room: "kitchen" });

    expect(gameState.character.stats.satiety).toBe(58);
    expect(gameState.character.stats.hydration).toBe(48);
    expect(gameState.character.stats.energy).toBe(82);

    expect(indoor.performAction("eat-rations")).toMatchObject({ ok: true });
    expect(itemQuantity(gameState.character.holdings, "tastee-tack-turkey-cranberry-meal")).toBe(1);
    expect(gameState.flags.has("day1.found-food")).toBe(true);
    expect(gameState.character.stats.satiety).toBeGreaterThan(99);

    expect(indoor.performAction("purify-water")).toMatchObject({ ok: true });
    expect(itemQuantity(gameState.character.holdings, "purified-water")).toBe(1);
    expect(gameState.flags.has("day1.found-water")).toBe(true);
    expect(gameState.character.stats.hydration).toBeGreaterThan(82);

    gameState.character.stats.energy = 55;
    setIndoorLocation(indoor, { room: "library" });
    expect(indoor.performAction("rest-in-library")).toMatchObject({ ok: true });

    expect(gameState.flags.has("day1.complete")).toBe(true);
    expect(gameState.character.stats.energy).toBeGreaterThan(94);
    expect(gameState.character.stats.health).toBe(100);
  });

  it("connects authored field actions to hydro state, save/load, console telemetry, and station power", async () => {
    const harness = buildHarness();
    const { gameState, indoor, outdoor, place } = harness;
    const rollDoorBefore = getDoorState(indoor.indoor.doorState, "utility-station", "large-bay-roll");
    expect(rollDoorBefore.locked).toBe(true);

    setIndoorLocation(indoor, { room: "control-room" });
    indoor.indoor.currentStand = "console";
    const cardActions = buildIndoorPlayActions(indoor);
    expect(cardActions.map((action) => action.id)).toContain("action:read-hydro-startup-card");
    expect(cardActions.map((action) => action.id)).not.toContain("action:read-micro-hydro-ops");
    expect(cardActions.map((action) => action.label)).toContain("Read the laminated startup card");
    expect(cardActions.map((action) => action.label)).toContain("Pick up the laminated startup card");
    expect(cardActions.map((action) => action.label).join(" ")).not.toContain("Micro-hydro Operations");

    expect(itemQuantity(
      gameState.character.holdings,
      "hydro-startup-instruction-card",
      { holderId: characterHolderId(gameState.character.holdings) },
    )).toBe(0);
    expect(itemQuantity(
      gameState.character.holdings,
      "hydro-startup-instruction-card",
      { holderId: "fixed:control-room-console" },
    )).toBe(1);

    const cardResult = handleIndoorPlayAction(indoor, "action:read-hydro-startup-card");
    expect(cardResult).toMatchObject({
      ok: true,
      view: {
        kind: "document",
        id: "hydro-startup-instruction-card",
        documentType: "hydro-startup-card",
      },
    });
    expect(gameState.flags.has("hydro.startup_card_read")).toBe(true);
    expect(gameState.flags.has("hydro.outdoor-actions")).toBe(true);
    expect(gameState.flags.has("hydro.discovered")).toBe(true);
    expect(gameState.character.documents["hydro-startup-instruction-card"].readAt).toBeTruthy();
    expect(itemQuantity(
      gameState.character.holdings,
      "hydro-startup-instruction-card",
      { holderId: characterHolderId(gameState.character.holdings) },
    )).toBe(0);
    expect(itemQuantity(
      gameState.character.holdings,
      "hydro-startup-instruction-card",
      { holderId: "fixed:control-room-console" },
    )).toBe(1);
    expect(buildIndoorPlayActions(indoor).map((action) => action.label))
      .toContain("Pick up the laminated startup card");
    expect(handleIndoorPlayAction(indoor, "holding-pickup:instance:hydro-startup-instruction-card-4"))
      .toMatchObject({ ok: true });
    expect(itemQuantity(
      gameState.character.holdings,
      "hydro-startup-instruction-card",
      { holderId: characterHolderId(gameState.character.holdings) },
    )).toBe(1);
    expect(itemQuantity(
      gameState.character.holdings,
      "hydro-startup-instruction-card",
      { holderId: "fixed:control-room-console" },
    )).toBe(0);

    setIndoorLocation(indoor, { exteriorNode: "upstream-bank" });
    let upstreamActions = buildIndoorPlayActions(indoor);
    expect(upstreamActions.map((action) => action.label)).toContain("Clear intake debris");
    expect(upstreamActions.map((action) => action.label)).not.toContain("Open intake");
    indoor.performAction("clear-intake-debris");
    upstreamActions = buildIndoorPlayActions(indoor);
    expect(upstreamActions.map((action) => action.label)).toContain("Open intake");
    indoor.performAction("open-intake");
    setIndoorLocation(indoor, { exteriorNode: "midstream-bank" });
    expect(buildIndoorPlayActions(indoor).map((action) => action.label)).toContain("Align the diversion valve");
    indoor.performAction("align-pipeflow");
    setIndoorLocation(indoor, { exteriorNode: "downstream-bank" });
    expect(buildIndoorPlayActions(indoor).map((action) => action.label)).toContain("Open turbine valve");
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
      "Intake debris cleared",
      "Intake opened",
      "Upstream manual valve opened",
      "Powerhouse manual valve opened",
      "Hydro generator startup completed",
    ]);
    expect(gameState.facilities.hydro.eventLog.map((event) => event.elapsedMinutes)).toEqual([
      30,
      45,
      75,
      95,
      110,
    ]);

    const consoleView = mount(HydroConsoleView, {
      props: {
        gameState,
        payload: { panelId: "hydro-control-room-panel" },
      },
    });
    expect(consoleView.text()).toContain("Online");
    expect(consoleView.text()).toContain("1.000 kW");
    expect(consoleView.text()).not.toContain("Next action");
    consoleView.unmount();

    const snapshot = captureSnapshot({ gameState, place, outdoor, indoor });
    const loaded = buildHarness();

    expect(applySnapshot(snapshot, loaded)).toBe(true);
    expect(loaded.gameState.facilities.hydro.online).toBe(true);
    expect(loaded.gameState.facilities.hydro.manualValves.powerhouseOpen).toBe(true);
    expect(loaded.indoor.indoor.facility.hydroOnline).toBe(true);
  });
});
