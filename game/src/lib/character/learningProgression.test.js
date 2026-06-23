import { describe, expect, it } from "vitest";
import { reactive, ref } from "vue";
import { characterDefinitions } from '../testing/content.js';
import { utilityData as utilityStation } from '../testing/content.js';
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createIndoorActions } from "../maps/composables/indoor/useIndoorActions.js";
import { createGameClock } from "./gameTime.js";

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

    expect(actions.availableActions.value.map((action) => action.id))
      .toContain("holo-reader-hydro-lesson");
    actions.performAction("holo-reader-hydro-lesson");

    expect(character.documents["hydro-operations-primer"].readAt).toBeTruthy();
    expect(character.knowledge["hydro-head-and-flow"].acquiredAt).toBeTruthy();
    expect(character.skills["hydro-operations"].rank).toBe(1);

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

  it("keeps document discovery separate from learned knowledge", () => {
    const character = createCharacterState(characterDefinitions);
    const indoor = reactive({
      currentRoom: "library",
      exteriorNode: null,
      completedActions: new Set(),
      flags: new Set(),
      facility: { hydroOnline: false },
    });
    const actions = createIndoorActions({
      building: ref(utilityStation),
      indoor,
      setHydroOnline: () => {},
      builderView: ref(false),
      character,
      gameState: {
        character,
        flags: indoor.flags,
        clock: createGameClock(),
      },
    });

    actions.performAction("library-read-hydro");
    expect(character.documents["hydro-operations-primer"].discoveredAt).toBeTruthy();
    expect(character.knowledge["hydro-head-and-flow"]).toBeUndefined();
  });

  it("tracks the authored hydro startup quest through automatic completion", () => {
    const character = createCharacterState(characterDefinitions);
    const flags = new Set();
    const indoor = reactive({
      currentRoom: "control-room",
      exteriorNode: null,
      completedActions: new Set(),
      flags,
      facility: { hydroOnline: false },
    });
    const actions = createIndoorActions({
      building: ref(utilityStation),
      indoor,
      setHydroOnline: (online) => { indoor.facility.hydroOnline = online; },
      builderView: ref(false),
      character,
      gameState: {
        character,
        flags,
        clock: createGameClock(),
      },
    });

    actions.performAction("read-micro-hydro-ops");
    expect(character.quests["restore-hydro"].status).toBe("active");

    indoor.currentRoom = null;
    indoor.exteriorNode = "upstream-bank";
    actions.performAction("clear-intake-debris");
    indoor.exteriorNode = "midstream-bank";
    actions.performAction("align-pipeflow");
    indoor.exteriorNode = "downstream-bank";
    actions.performAction("open-turbine-valve");
    indoor.currentRoom = "control-room";
    indoor.exteriorNode = null;
    actions.performAction("connect-power");

    expect(character.quests["restore-hydro"].status).toBe("completed");
    const objectives = Object.values(character.quests["restore-hydro"].objectives);
    expect(objectives).toHaveLength(4);
    expect(objectives.every((objective) => objective.status === "completed")).toBe(true);
  });
});
