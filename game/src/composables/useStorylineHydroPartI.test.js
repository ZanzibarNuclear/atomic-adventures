// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { createGameState, setPlayMode } from "./useGameState.js";
import { useStoryline, filterAllowedActions } from "./useStoryline.js";
import {
  buildIndoorPlayActions,
  handleIndoorPlayAction,
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

function buildHarness(mode = "story") {
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
  setPlayMode(gameState, mode, mode === "story"
    ? { scenarioId: "part-i-station", stepId: "understand-building" }
    : {});
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

function filteredFacilityActionIds(harness) {
  return filteredActionIds(harness).filter((id) => id.startsWith("action:"));
}

async function tick(harness) {
  harness.storyline.tick();
  await nextTick();
}

describe("Part I hydro play modes", () => {
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
