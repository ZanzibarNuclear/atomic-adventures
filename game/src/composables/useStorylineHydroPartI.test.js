// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { createGameState, setPlayMode } from "./useGameState.js";
import { useStoryline, filterAllowedActions, isActionAllowed } from "./useStoryline.js";
import {
  buildOutdoorPlayActions,
  buildIndoorPlayActions,
  getMovementOptions,
  handleIndoorPlayAction,
  handleOutdoorPlayAction,
} from "./usePlayPanel.js";
import { useIndoorBuilding } from "../lib/maps/composables/useIndoorBuilding.js";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import characterContent from "../../public/content/character.json";
import storylineContent from "../../public/content/storyline.json";
import utilityStationContent from "../../public/content/utility-station.json";
import worldContent from "../../public/content/world.json";

const characterDefinitions = characterContent.character;
const storylineData = ref(storylineContent.storyline);
const mapData = worldContent.world;
const utilityData = utilityStationContent.building;

function buildHarness(mode = "story", storylineStart = {
  scenarioId: "part-i-station",
  stepId: "understand-building",
}) {
  const place = ref("outdoors");
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
  const openedViews = [];
  setPlayMode(gameState, mode, mode === "story" ? storylineStart : {});
  const storyline = useStoryline(storylineData, {
    gameState,
    place,
    outdoor,
    indoor,
    openStageView: (view) => {
      openedViews.push(view);
      return true;
    },
  });
  return { gameState, place, outdoor, indoor, storyline, openedViews };
}

function setIndoorLocation(harness, { room = null, exteriorNode = null }) {
  harness.place.value = "indoors";
  harness.indoor.indoor.currentRoom = room;
  harness.indoor.indoor.currentStand = room ? "console" : null;
  harness.indoor.indoor.exteriorNode = exteriorNode;
}

function filteredActionIds(harness) {
  return filterAllowedActions(
    buildIndoorPlayActions(harness.indoor),
    harness.storyline.actionPolicy.value,
  ).map((action) => action.id);
}

function filteredOutdoorActionIds(harness, pendingBeat = null) {
  return filterAllowedActions(
    [
      ...getMovementOptions(harness.outdoor, pendingBeat),
      ...buildOutdoorPlayActions(harness.outdoor, pendingBeat),
    ],
    harness.storyline.actionPolicy.value,
  ).map((action) => action.id);
}

function filteredFacilityActionIds(harness) {
  return filteredActionIds(harness).filter((id) => id.startsWith("action:"));
}

async function tick(harness) {
  harness.outdoor.traveling = false;
  harness.storyline.tick();
  await nextTick();
}

async function chooseOutdoor(harness, actionId) {
  expect(filteredOutdoorActionIds(harness), `Expected ${actionId} to be visible`).toContain(actionId);
  handleOutdoorPlayAction(harness.outdoor, actionId);
  await tick(harness);
}

async function chooseOutdoorDestination(harness, hexId) {
  const actionId = filteredOutdoorActionIds(harness).find((id) => id.endsWith(`:${hexId}`));
  expect(actionId, `Expected an action to ${hexId} to be visible`).toBeDefined();
  await chooseOutdoor(harness, actionId);
}

describe("Part I hydro play modes", () => {
  it("keeps the opening story path visible while allowing valid detours", async () => {
    const harness = buildHarness("story", {
      scenarioId: "part-i-opener",
      stepId: "survive-in-the-woods",
    });

    expect(harness.storyline.currentObjective.value).toBe("Keep moving. Find something that can help you survive.");
    expect(filteredOutdoorActionIds(harness)).toContain("move-hex:east-pines");

    await chooseOutdoor(harness, "move-hex:east-pines");
    expect(harness.storyline.activeStep.value.id).toBe("keep-moving-west");
    expect(harness.storyline.currentObjective.value).toBe("Keep moving. Stay across the slope.");
    expect(filteredOutdoorActionIds(harness)).toEqual(
      expect.arrayContaining(["move-hex:far-pines", "move-hex:center-pines", "move-hex:lower-stand"]),
    );
  });

  it("supports the canonical gate-to-station story path", async () => {
    const harness = buildHarness("story", {
      scenarioId: "part-i-opener",
      stepId: "survive-in-the-woods",
    });

    await chooseOutdoor(harness, "move-hex:east-pines");
    await chooseOutdoor(harness, "move-hex:center-pines");
    expect(harness.storyline.activeStep.value.id).toBe("reach-the-gate");

    await chooseOutdoorDestination(harness, "north-bend");
    await chooseOutdoorDestination(harness, "gate-woods");
    expect(harness.storyline.activeScenario.value.id).toBe("part-i-station");
    expect(harness.storyline.activeStep.value.id).toBe("find-a-way-past-fence");
    expect(isActionAllowed("item-action:half-eaten-energy-bar.eat", harness.storyline.actionPolicy.value, {
      itemId: "half-eaten-energy-bar",
      actionId: "eat",
    })).toBe(true);
    expect(isActionAllowed("item-action:half-full-water-bottle.drink", harness.storyline.actionPolicy.value, {
      itemId: "half-full-water-bottle",
      actionId: "drink",
    })).toBe(true);
    expect(filteredOutdoorActionIds(harness)).toContain("passage-toggle:compound-gate");

    await chooseOutdoor(harness, "passage-toggle:compound-gate");
    expect(filteredOutdoorActionIds(harness)).toContain("passage:compound-gate");
    await chooseOutdoor(harness, "passage:compound-gate");
    await chooseOutdoorDestination(harness, "west-slope");
    await chooseOutdoorDestination(harness, "utility-yard");

    expect(harness.outdoor.state.currentId).toBe("utility-yard");
    expect(harness.storyline.activeStep.value.id).toBe("look-for-shelter");
    expect(harness.storyline.currentObjective.value).toBe("Look for shelter before you run out of light.");
  });

  it("supports the noncanonical fence-hole shortcut in story mode", async () => {
    const harness = buildHarness("story", {
      scenarioId: "part-i-station",
      stepId: "find-a-way-past-fence",
    });
    harness.outdoor.state.currentId = "south-pines";
    harness.outdoor.state.stand = harness.outdoor.defaultStandForHex("south-pines");
    await tick(harness);

    expect(filteredOutdoorActionIds(harness)).toContain("search:barrier");
    await chooseOutdoor(harness, "search:barrier");
    expect(harness.outdoor.state.discoveredOpenings).toContain("south-pines-hole");
    expect(filteredOutdoorActionIds(harness)).toContain("passage:south-pines-hole");

    await chooseOutdoorDestination(harness, "utility-yard");

    expect(harness.outdoor.state.currentId).toBe("utility-yard");
    expect(harness.storyline.activeStep.value.id).toBe("look-for-shelter");
  });

  it("guides the hydro startup sequence with story gates active", async () => {
    const harness = buildHarness("story");

    setIndoorLocation(harness, { room: "control-room" });
    await tick(harness);
    expect(harness.storyline.activeStep.value.id).toBe("understand-building");
    expect(filteredFacilityActionIds(harness)).toEqual(["action:read-hydro-startup-card"]);

    expect(handleIndoorPlayAction(harness.indoor, "action:read-hydro-startup-card")).toMatchObject({
      ok: true,
      view: { kind: "document", id: "hydro-startup-instruction-card" },
    });
    await tick(harness);
    expect(harness.storyline.activeStep.value.id).toBe("inspect-intake");

    setIndoorLocation(harness, { exteriorNode: "upstream-bank" });
    await tick(harness);
    expect(harness.storyline.activeStep.value.id).toBe("clear-open-intake");
    expect(filteredFacilityActionIds(harness)).toEqual(["action:clear-intake-debris"]);
    expect(handleIndoorPlayAction(harness.indoor, "action:clear-intake-debris")).toMatchObject({ ok: true });
    expect(filteredFacilityActionIds(harness)).toEqual(["action:open-intake"]);
    expect(handleIndoorPlayAction(harness.indoor, "action:open-intake")).toMatchObject({ ok: true });
    await tick(harness);

    setIndoorLocation(harness, { exteriorNode: "midstream-bank" });
    expect(filteredFacilityActionIds(harness)).toEqual(["action:align-pipeflow"]);
    expect(handleIndoorPlayAction(harness.indoor, "action:align-pipeflow")).toMatchObject({ ok: true });
    await tick(harness);

    setIndoorLocation(harness, { exteriorNode: "downstream-bank" });
    expect(filteredFacilityActionIds(harness)).toEqual(["action:open-turbine-valve"]);
    expect(handleIndoorPlayAction(harness.indoor, "action:open-turbine-valve")).toMatchObject({ ok: true });
    await tick(harness);

    setIndoorLocation(harness, { room: "control-room" });
    await tick(harness);
    expect(harness.storyline.activeStep.value.id).toBe("connect-power");
    expect(filteredFacilityActionIds(harness)).toEqual(["action:connect-power"]);
    expect(handleIndoorPlayAction(harness.indoor, "action:connect-power")).toMatchObject({ ok: true });
    await tick(harness);

    expect(harness.gameState.facilities.hydro).toMatchObject({
      intakeClear: true,
      intakeOpen: true,
      manualValves: {
        upstreamOpen: true,
        powerhouseOpen: true,
      },
      online: true,
      startupComplete: true,
    });
    expect(harness.openedViews).toContainEqual({
      kind: "console",
      id: "hydro",
      focus: "generation",
    });
    expect(harness.gameState.storyline.stepId).toBeNull();
  });

  it("keeps open-world mode broad while facility rules still decide availability", () => {
    const harness = buildHarness("open-world");
    setIndoorLocation(harness, { exteriorNode: "midstream-bank" });

    expect(filteredFacilityActionIds(harness)).toEqual([]);

    harness.gameState.flags.add("hydro.open-intake");
    expect(filteredFacilityActionIds(harness)).toEqual(["action:align-pipeflow"]);
  });
});
