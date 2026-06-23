import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { utilityData } from '../../testing/content.js';
import { createIndoorPlayer } from "../composables/indoor/useIndoorPlayer.js";
import { doorStateKey } from "../composables/useDoors.js";
import { createCharacterState } from "../../../composables/useCharacterState.js";
import { itemQuantity } from "../../character/holdings.js";

describe("indoor building live refresh", () => {
  it("preserves valid player state and initializes new geometry", () => {
    const player = createIndoorPlayer(utilityData, ref(false));
    player.indoor.currentRoom = "library";
    player.indoor.currentStand = null;
    player.indoor.exteriorNode = null;
    player.indoor.discovered = new Set(["library", "missing-room"]);
    player.indoor.revealed = new Set(["library", "door:library-hallway"]);
    player.indoor.doorState[doorStateKey("utility-station", "library-hallway")].open = true;

    const next = structuredClone(utilityData);
    next.rooms.push({
      id: "new-room",
      level: "first",
      x: 8,
      y: 8,
      w: 1,
      h: 1,
      label: "New Room",
    });
    next.doors.push({
      id: "new-door",
      kind: "man",
      level: "first",
      at: { x: 8, y: 8.5 },
      initial: { closed: true, locked: false },
    });

    player.syncFromBuildingData(next);

    expect(player.indoor.currentRoom).toBe("library");
    expect(player.indoor.currentStand).toBeNull();
    expect(player.indoor.discovered).toEqual(new Set(["library"]));
    expect(player.indoor.revealed).toContain("door:library-hallway");
    expect(player.indoor.doorState[
      doorStateKey("utility-station", "library-hallway")
    ].open).toBe(true);
    expect(player.indoor.doorState[
      doorStateKey("utility-station", "new-door")
    ].open).toBe(false);
  });

  it("takes catalog-backed pickups only once", () => {
    const character = createCharacterState({
      items: [{
        id: "lobby-exterior-key",
        label: "Lobby exterior key",
        carrying: "unique",
        maxQuantity: 1,
      }],
      stats: [],
      knowledge: [],
      skills: [],
      quests: [],
      documents: [],
    });
    const player = createIndoorPlayer(utilityData, ref(false), {
      character,
      flags: new Set(),
    });
    player.indoor.currentRoom = "control-lobby";
    player.indoor.exteriorNode = null;

    player.tryPickup("lobby-desk-keys");
    player.tryPickup("lobby-desk-keys");

    expect(itemQuantity(character.holdings, "lobby-exterior-key")).toBe(1);
    expect(player.indoor.pickupsTaken).toEqual(new Set(["lobby-desk-keys"]));
  });
});
