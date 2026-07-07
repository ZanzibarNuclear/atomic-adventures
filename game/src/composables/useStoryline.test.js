import { describe, expect, it } from "vitest";
import { nextTick, reactive, ref } from "vue";
import { createGameState, setPlayMode } from "./useGameState.js";
import {
  actionPromptCategory,
  annotateActionPrompts,
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
    id: "part-i-opener",
    label: "Part I Opener",
    defaultMode: "story",
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
  setPlayMode(gameState, "story", {
    scenarioId: "part-i-opener",
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

    expect(setup.api.activeScenario.value.id).toBe("part-i-opener");
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

  it("hands off to the next scenario at a storyline boundary", async () => {
    const setup = harness({
      scenarios: [
        scenario({
          steps: [{
            id: "intro",
            objective: "Reach the gate.",
            allowed: {},
            completesWhen: { flag: "story.at-gate" },
            nextScenario: "part-i-station",
          }],
        }),
        scenario({
          id: "part-i-station",
          label: "Part I Station",
          startStep: "find-a-way-past-fence",
          steps: [{
            id: "find-a-way-past-fence",
            objective: "Find a way past the fence.",
            allowed: {},
            completesWhen: { flag: "story.inside-fence" },
            next: null,
          }],
        }),
      ],
    });

    setup.gameState.flags.add("story.at-gate");
    setup.api.tick();
    await nextTick();

    expect(setup.gameState.storyline.completedStepIds).toContain("intro");
    expect(setup.gameState.storyline.scenarioId).toBe("part-i-station");
    expect(setup.gameState.storyline.stepId).toBe("find-a-way-past-fence");
    expect(setup.api.currentObjective.value).toBe("Find a way past the fence.");
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
    setup.gameState.lessons["hydro-power-stream-to-socket"] = { completedAt: "now" };
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
      completesWhen: { lesson: { id: "hydro-power-stream-to-socket", status: "completed" } },
    }, setup)).toBe(true);
  });

  it("reports a missing active step as an authoring error", () => {
    const setup = harness();
    setup.gameState.storyline.stepId = "missing-step";

    expect(setup.api.authoringError.value).toBe('Storyline step "missing-step" was not found.');
  });

  it("allows open-world actions without story gates", () => {
    const policy = { mode: "open-world", unrestricted: true };

    expect(isActionAllowed("action:anything", policy)).toBe(true);
    expect(isDestinationAllowed(policy, { type: "room", id: "control-room" })).toBe(true);
    expect(isStageViewAllowed(policy, { kind: "console", id: "hydro" })).toBe(true);
  });

  it("limits available actions to rest or sleep when energy is depleted", () => {
    const policy = { mode: "open-world", unrestricted: true, mustRest: true };

    expect(isActionAllowed({ id: "action:rest-in-library", label: "Rest in the library" }, policy)).toBe(true);
    expect(isActionAllowed({ id: "action:sleep", label: "Sleep" }, policy)).toBe(true);
    expect(isActionAllowed({ id: "move-room:kitchen", label: "Go to kitchen" }, policy)).toBe(false);
    expect(filterAllowedActions([
      { id: "move-room:kitchen", label: "Go to kitchen" },
      { id: "action:rest-in-library", label: "Rest in the library" },
    ], policy)).toEqual([
      expect.objectContaining({ id: "action:rest-in-library" }),
    ]);
  });

  it("filters actions through exact and semantic story allowances", () => {
    const policy = {
      mode: "story",
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
        storyForwardActions: ["action:clear-intake-debris"],
        optionalActions: ["action:optional-lookaround"],
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
      { id: "story:2", toRoomId: "control-room" },
      { id: "story:3", toRoomId: "garage" },
      { id: "story:4", toHexId: "south-pines" },
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
      "story:2",
      "story:3",
      "story:4",
      "action:clear-intake-debris",
      "action:optional-lookaround",
      "door-open:control-room-door",
      "search:barrier",
      "hydro-console:open",
      "item-action:hydro-startup-instruction-card.read",
      "move-room:garage",
      "move-stand:window",
      "route:east-pines",
    ]);

    expect(actionPromptCategory({ id: "action:clear-intake-debris" }, policy)).toBe("ordinary");
    expect(actionPromptCategory({ id: "action:optional-lookaround" }, policy)).toBe("ordinary");
    expect(annotateActionPrompts([{ id: "search:barrier" }], policy)).toEqual([
      { id: "search:barrier", promptCategory: "ordinary" },
    ]);
  });

  it("keeps story-continuing movement visually ordinary without suppressing detours", () => {
    const policy = {
      mode: "story",
      unrestricted: false,
      allowed: {
        movement: { hexes: ["east-pines"], rooms: ["control-room"], exteriorNodes: ["upstream-bank"] },
      },
    };

    expect(isActionAllowed("move-hex:lower-stand", policy)).toBe(true);
    expect(actionPromptCategory({ id: "move-hex:east-pines", toHexId: "east-pines" }, policy)).toBe("ordinary");
    expect(actionPromptCategory({ id: "move-hex:lower-stand", toHexId: "lower-stand" }, policy)).toBe("ordinary");
    expect(actionPromptCategory({ id: "move-room:control-room" }, policy)).toBe("ordinary");
    expect(actionPromptCategory({ id: "move-exterior:upstream-bank" }, policy)).toBe("ordinary");
  });

  it("allows movement-shaped story choices without opening every story choice", () => {
    const policy = {
      mode: "story",
      unrestricted: false,
      allowed: {
        movement: {
          rooms: ["kitchen"],
          exteriorNodes: ["intake-entrance"],
          hexes: ["utility-yard"],
        },
      },
    };

    expect(isActionAllowed({ id: "story:0", toRoomId: "kitchen" }, policy)).toBe(true);
    expect(isActionAllowed({ id: "story:1", toExteriorNode: "intake-entrance" }, policy)).toBe(true);
    expect(isActionAllowed({ id: "story:2", toHexId: "utility-yard" }, policy)).toBe(true);
    expect(isActionAllowed({ id: "story:3", toRoomId: "control-room" }, policy)).toBe(true);
    expect(isActionAllowed({ id: "story:4" }, policy)).toBe(false);
  });

  it("keeps ordinary movement destinations available in story mode", () => {
    const currentOnly = {
      mode: "story",
      unrestricted: false,
      allowed: { movement: { mode: "current-location-only", rooms: ["control-room"] } },
    };
    const localArea = {
      mode: "story",
      unrestricted: false,
      allowed: { movement: { mode: "local-area" } },
    };
    const explicit = {
      mode: "story",
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

  it("blocks story-sensitive nonmovement actions without changing ordinary movement", () => {
    const policy = {
      mode: "story",
      unrestricted: false,
      allowed: {
        movement: { mode: "local-area" },
        stageViews: [{ kind: "character", tab: "overview" }],
        indoorActions: ["door-open:garage-side-door"],
        outdoorActions: ["search:barrier"],
        itemActions: ["ration.eat"],
      },
    };

    expect(isActionAllowed("move-room:kitchen", policy)).toBe(true);
    expect(isActionAllowed("route:gate-woods", policy)).toBe(true);
    expect(isActionAllowed("door-open:garage-side-door", policy)).toBe(true);
    expect(isActionAllowed("door-open:control-room-door", policy)).toBe(false);
    expect(isActionAllowed("search:barrier", policy)).toBe(true);
    expect(isActionAllowed("passage-toggle:fence-hole", policy)).toBe(false);
    expect(isActionAllowed("item-action:ration.eat", policy)).toBe(true);
    expect(isActionAllowed("item-action:hydro-startup-instruction-card.read", policy)).toBe(false);
    expect(isStageViewAllowed(policy, { kind: "character", tab: "overview" })).toBe(true);
    expect(isStageViewAllowed(policy, { kind: "lesson", id: "hydro-power-stream-to-socket" })).toBe(false);
  });
});
