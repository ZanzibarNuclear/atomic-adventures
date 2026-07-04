import { describe, expect, it } from "vitest";
import { reactive, ref } from "vue";
import { characterDefinitions } from '../testing/content.js';
import { utilityData as utilityStation } from '../testing/content.js';
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createIndoorActions } from "../maps/composables/indoor/useIndoorActions.js";
import { createGameClock } from "./gameTime.js";
import { learningSeed } from "../../../server/learning-seed.js";
import { completeLesson } from "../learning/completion.js";
import { generateHydroTelemetry } from "../simulations/hydro/index.js";

describe("authored learning progression", () => {
  it("moves from lesson to knowledge, practice evidence, and qualification", () => {
    const flags = new Set(["hub.hydro_online"]);
    const character = createCharacterState(characterDefinitions);
    const indoor = reactive({
      currentRoom: "library",
      exteriorNode: null,
      completedActions: new Set(),
      flags,
      facility: { hydroOnline: true },
    });
    const gameState = {
      character,
      flags,
      clock: createGameClock(),
    };
    const actions = createIndoorActions({
      building: ref(utilityStation),
      indoor,
      setHydroOnline: () => {},
      builderView: ref(false),
      character,
      gameState,
    });

    expect(actions.availableActions.value.some((action) =>
      (action.effects ?? []).some((effect) =>
        effect.op === "knowledge.acquire" && effect.id === "hydro-head-and-flow")
    )).toBe(false);
    const lesson = learningSeed.lessons.find((entry) => entry.id === "hydro-power-intro");
    const result = completeLesson(gameState, lesson, { now: () => "lesson-passed" });

    expect(result.ok).toBe(true);
    expect(character.knowledge["hydro-head-and-flow"].acquiredAt).toBe("lesson-passed");
    expect(gameState.lessons["hydro-power-intro"].completedAt).toBe("lesson-passed");

    indoor.currentRoom = "control-room";
    for (let day = 0; day < 3; day += 1) {
      actions.performAction("run-hydro-operating-day");
    }
    expect(character.skills["hydro-operations"].evidence["operating-days"]).toBe(3);
    expect(character.skills["hydro-operations"].rank).toBe(2);

    indoor.currentRoom = null;
    indoor.exteriorNode = "midstream-bank";
    actions.performAction("patch-penstock-leak");
    actions.performAction("patch-penstock-leak");
    expect(character.skills["hydro-operations"].evidence["leak-repairs"]).toBe(1);

    indoor.currentRoom = "control-room";
    indoor.exteriorNode = null;
    actions.performAction("run-hydro-operating-day");
    actions.performAction("run-hydro-operating-day");
    expect(character.skills["hydro-operations"].rank).toBe(3);
    expect(character.skills["hydro-operations"].awards["3"].earnedText)
      .toBe("Qualified hydro operator");
  });

  it("does not reapply effects when a completed lesson is replayed", () => {
    const character = createCharacterState(characterDefinitions);
    const gameState = {
      character,
      flags: new Set(["hub.hydro_online"]),
      clock: createGameClock(),
      lessons: {},
    };
    const lesson = learningSeed.lessons.find((entry) => entry.id === "hydro-power-intro");

    expect(completeLesson(gameState, lesson, { now: () => "first" }).ok).toBe(true);
    expect(completeLesson(gameState, lesson, { now: () => "second" }).alreadyCompleted).toBe(true);

    expect(gameState.lessons["hydro-power-intro"].completedAt).toBe("first");
    expect(character.knowledge["hydro-head-and-flow"].acquiredAt).toBe("first");
  });

  it("tracks the authored hydro startup quest through automatic completion", () => {
    const character = createCharacterState(characterDefinitions);
    const flags = new Set();
    const indoor = reactive({
      currentRoom: "control-room",
      currentStand: "console",
      exteriorNode: null,
      completedActions: new Set(),
      flags,
      facility: { hydroOnline: false },
    });
    const gameState = {
      character,
      flags,
      clock: createGameClock(),
      facilities: {},
    };
    const actions = createIndoorActions({
      building: ref(utilityStation),
      indoor,
      setHydroOnline: (online) => { indoor.facility.hydroOnline = online; },
      builderView: ref(false),
      character,
      gameState,
    });

    const cardResult = actions.performAction("read-hydro-startup-card");
    expect(cardResult.view).toMatchObject({
      kind: "document",
      id: "hydro-startup-instruction-card",
    });
    expect(character.quests["restore-hydro"].status).toBe("active");

    indoor.currentRoom = null;
    indoor.exteriorNode = "upstream-bank";
    actions.performAction("clear-intake-debris");
    actions.performAction("open-intake");
    indoor.exteriorNode = "midstream-bank";
    actions.performAction("align-pipeflow");
    indoor.exteriorNode = "downstream-bank";
    actions.performAction("open-turbine-valve");
    indoor.currentRoom = "control-room";
    indoor.exteriorNode = null;
    actions.performAction("connect-power");

    expect(character.quests["restore-hydro"].status).toBe("completed");
    expect(indoor.facility.hydroOnline).toBe(true);
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
    expect(gameState.facilities.hydro.eventLog.map((event) => event.label)).toEqual([
      "Intake debris cleared",
      "Intake opened",
      "Upstream manual valve opened",
      "Powerhouse manual valve opened",
      "Hydro generator startup completed",
    ]);
    expect(generateHydroTelemetry(gameState.facilities.hydro)).toMatchObject({
      status: "online",
      generatorOutputKw: 1,
    });
    const objectives = Object.values(character.quests["restore-hydro"].objectives);
    expect(objectives).toHaveLength(5);
    expect(objectives.every((objective) => objective.status === "completed")).toBe(true);
  });
});
