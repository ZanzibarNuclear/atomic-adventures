import { describe, expect, it } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { createGameState, setPlayMode } from "./useGameState.js";
import {
  filterAllowedActions,
  isActionAllowed,
  isDestinationAllowed,
  isStageViewAllowed,
  useStoryline,
  isStepComplete,
} from "./useStoryline.js";
import { mapData, utilityData } from "../lib/testing/content.js";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { addItem } from "../lib/character/holdings.js";

function scenario(overrides = {}) {
  return {
    id: "part-i-hydro-alpha",
    label: "Hydro Startup Storyline",
    defaultMode: "storyline",
    startStep: "intro",
    steps: [
      {
        id: "intro",
        objective: "Get oriented.",
        allowed: {},
        completesWhen: { flag: "story.intro.complete" },
        next: "read-card",
      },
      {
        id: "read-card",
        objective: "Read the card.",
        allowed: {},
        completesWhen: { flag: "story.card.read" },
        next: null,
      },
    ],
    ...overrides,
  };
}

function harness(storyline = { scenarios: [scenario()] }) {
  const storylineData = ref(storyline);
  const place = ref("outdoors");
  const gameState = createGameState({
    mapData,
    buildingData: utilityData,
    characterData: {
      items: [{ id: "hydro-startup-card", label: "Hydro startup card", carrying: "unique", maxQuantity: 1 }],
      stats: [],
      knowledge: [],
      skills: [],
      quests: [],
      documents: [],
    },
  });
  const outdoor = useOutdoorWorld(mapData, gameState);
  const indoor = {
    indoor: reactive({
      currentRoom: null,
      exteriorNode: null,
    }),
    moveToRoom: (room) => {
      indoor.indoor.currentRoom = room;
      indoor.indoor.exteriorNode = null;
    },
    moveToExteriorNode: (node) => {
      indoor.indoor.currentRoom = null;
      indoor.indoor.exteriorNode = node;
    },
  };
  setPlayMode(gameState, "storyline", {
    scenarioId: "part-i-hydro-alpha",
    stepId: "intro",
    objective: "Get oriented.",
  });
  const openedViews = [];
  const openedViewOptions = [];
  const api = useStoryline(storylineData, {
    gameState,
    place,
    outdoor,
    indoor,
    openStageView: (view, options) => {
      openedViews.push(view);
      openedViewOptions.push(options);
      return true;
    },
  });
  return { storylineData, gameState, place, outdoor, indoor, api, openedViews, openedViewOptions };
}

describe("useStoryline", () => {
  it("resolves the active scenario, step, and objective", () => {
    const setup = harness();

    expect(setup.api.activeScenario.value.id).toBe("part-i-hydro-alpha");
    expect(setup.api.activeStep.value.id).toBe("intro");
    expect(setup.api.currentObjective.value).toBe("Get oriented.");
    expect(setup.api.authoringError.value).toBe("");
  });

  it("advances when a flag completion predicate becomes true", async () => {
    const setup = harness();

    setup.gameState.flags.add("story.intro.complete");
    setup.api.tick();
    await nextTick();

    expect(setup.gameState.storyline.completedStepIds).toContain("intro");
    expect(setup.gameState.storyline.stepId).toBe("read-card");
    expect(setup.api.currentObjective.value).toBe("Read the card.");
  });

  it("applies onEnter effects once per step", () => {
    const setup = harness({
      scenarios: [scenario({
        steps: [{
          id: "intro",
          objective: "Wait.",
          allowed: {},
          onEnter: {
            timeMinutes: 5,
            activity: "light",
            setFlags: ["story.entered"],
          },
          completesWhen: { flag: "story.done" },
          next: null,
        }],
      })],
    });

    setup.api.tick();
    setup.api.tick();

    expect(setup.gameState.clock.elapsedMinutes).toBe(5);
    expect(setup.gameState.flags.has("story.entered")).toBe(true);
    expect(setup.gameState.storyline.enteredStepIds).toEqual(["intro"]);
  });

  it("applies onComplete effects and does not repeat a completed step", () => {
    const setup = harness({
      scenarios: [scenario({
        steps: [{
          id: "intro",
          objective: "Finish.",
          allowed: {},
          completesWhen: { flag: "story.ready" },
          onComplete: {
            setFlags: ["story.finished"],
            view: { kind: "document", id: "hydro-startup-card" },
          },
          next: null,
        }],
      })],
    });

    setup.gameState.flags.add("story.ready");
    setup.api.tick();
    setup.api.tick();

    expect(setup.gameState.storyline.completedStepIds).toEqual(["intro"]);
    expect(setup.gameState.storyline.stepId).toBeNull();
    expect(setup.gameState.flags.has("story.finished")).toBe(true);
    expect(setup.openedViews).toEqual([{ kind: "document", id: "hydro-startup-card" }]);
    expect(setup.openedViewOptions).toEqual([{ force: true }]);
  });

  it("evaluates facility, location, holding, and lesson predicates", () => {
    const setup = harness();
    setup.gameState.facilities.hydro.intakeOpen = true;
    setup.place.value = "indoors";
    setup.indoor.indoor.currentRoom = "control-room";
    setup.gameState.lessons["hydro-power-intro-alpha"] = { completedAt: "now" };
    addItem(
      setup.gameState.character.holdings,
      setup.gameState.character.definitions,
      "hydro-startup-card",
      1,
    );

    expect(isStepComplete({ completesWhen: { facility: { "hydro.intakeOpen": true } } }, setup)).toBe(true);
    expect(isStepComplete({ completesWhen: { location: { place: "indoors", room: "control-room" } } }, setup)).toBe(true);
    expect(isStepComplete({ completesWhen: { holding: { item: "hydro-startup-card" } } }, setup)).toBe(true);
    expect(isStepComplete({
      completesWhen: { lesson: { id: "hydro-power-intro-alpha", status: "completed" } },
    }, setup)).toBe(true);
  });

  it("reports a missing active step as an authoring error", () => {
    const setup = harness();
    setup.gameState.storyline.stepId = "missing-step";

    expect(setup.api.authoringError.value).toBe('Storyline step "missing-step" was not found.');
  });

  it("allows open-world actions without storyline gates", () => {
    const policy = { mode: "open-world", unrestricted: true };

    expect(isActionAllowed("action:anything", policy)).toBe(true);
    expect(isDestinationAllowed(policy, { type: "room", id: "control-room" })).toBe(true);
    expect(isStageViewAllowed(policy, { kind: "console", id: "hydro" })).toBe(true);
  });

  it("filters actions through exact and semantic storyline allowances", () => {
    const policy = {
      mode: "storyline",
      unrestricted: false,
      allowed: {
        movement: {
          mode: "current-location-only",
          rooms: ["control-room"],
          exteriorNodes: [],
          hexes: [],
          transitions: [],
        },
        storyChoices: ["story:0"],
        stageViews: [{ kind: "console", id: "hydro" }],
        indoorActions: ["clear-intake-debris", "door-open:control-room-door"],
        outdoorActions: ["search:barrier"],
        itemActions: ["hydro-startup-instruction-card.read"],
      },
    };

    expect(isActionAllowed("item-action:hydro-startup-instruction-card.read", policy)).toBe(true);
    expect(isActionAllowed("item-action:hydro-startup-instruction-card.discard", policy)).toBe(false);
    expect(isActionAllowed("read", policy, {
      itemId: "hydro-startup-instruction-card",
      actionId: "read",
    })).toBe(true);
    expect(filterAllowedActions([
      { id: "story:0" },
      { id: "story:1" },
      { id: "action:clear-intake-debris" },
      { id: "action:optional-lookaround" },
      { id: "door-open:control-room-door" },
      { id: "search:barrier" },
      { id: "hydro-console:open" },
      { id: "item-action:hydro-startup-instruction-card.read" },
      { id: "move-room:garage" },
      { id: "move-stand:window" },
      { id: "route:east-pines" },
    ], policy).map((action) => action.id)).toEqual([
      "story:0",
      "action:clear-intake-debris",
      "door-open:control-room-door",
      "search:barrier",
      "hydro-console:open",
      "item-action:hydro-startup-instruction-card.read",
      "move-room:garage",
      "move-stand:window",
      "route:east-pines",
    ]);
  });

  it("keeps ordinary movement destinations available in storyline mode", () => {
    const currentOnly = {
      mode: "storyline",
      unrestricted: false,
      allowed: { movement: { mode: "current-location-only", rooms: ["control-room"] } },
    };
    const localArea = {
      mode: "storyline",
      unrestricted: false,
      allowed: { movement: { mode: "local-area" } },
    };
    const explicit = {
      mode: "storyline",
      unrestricted: false,
      allowed: { movement: { rooms: ["control-room"] } },
    };

    expect(isDestinationAllowed(currentOnly, { type: "room", id: "control-room" })).toBe(true);
    expect(isDestinationAllowed(currentOnly, { type: "room", id: "garage" })).toBe(true);
    expect(isDestinationAllowed(localArea, { type: "room", id: "garage" })).toBe(true);
    expect(isDestinationAllowed(explicit, { type: "room", id: "control-room" })).toBe(true);
    expect(isDestinationAllowed(explicit, { type: "room", id: "garage" })).toBe(true);
    expect(isDestinationAllowed(explicit, { type: "hex", id: "south-pines" })).toBe(true);
    expect(isDestinationAllowed(explicit, { type: "transition", id: "building" })).toBe(true);
  });
});
