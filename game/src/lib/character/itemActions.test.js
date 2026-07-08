import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createGameClock } from "./gameTime.js";
import { addItem, itemQuantity } from "./holdings.js";
import { performItemAction } from "./itemActions.js";

function state() {
  const character = createCharacterState({
    items: [{
      id: "pack",
      label: "Pack",
      kind: "container",
      carrying: "unique",
      container: {
        capacity: { slots: 4 },
        accepts: { kinds: ["consumable", "item"] },
      },
    }, {
      id: "meal",
      label: "Meal",
      kind: "consumable",
      carrying: "stack",
      maxQuantity: 10,
      actions: [{
        id: "eat",
        label: "Eat",
        consume: 1,
        timeMinutes: 20,
        activity: "resting",
        effects: [{ op: "stat.add", id: "satiety", value: 55 }],
      }],
    }, {
      id: "bottle",
      label: "Bottle",
      kind: "consumable",
      carrying: "unique",
      actions: [{
        id: "drink",
        label: "Drink",
        consume: 0,
        consumeOptions: [
          { id: "sip", label: "Sip", portion: 0.25 },
          { id: "all", label: "Drink all remaining", remaining: true },
        ],
        depletedItem: "empty-bottle",
        timeMinutes: 0,
        effects: [{ op: "stat.add", id: "hydration", value: 100, scaleBy: "portion" }],
      }],
    }, {
      id: "empty-bottle",
      label: "Empty bottle",
      kind: "item",
      carrying: "unique",
    }, {
      id: "empty-wrapper",
      label: "Empty wrapper",
      kind: "item",
      carrying: "unique",
    }, {
      id: "snack",
      label: "Snack",
      kind: "consumable",
      carrying: "unique",
      actions: [{
        id: "eat",
        label: "Eat snack",
        consume: 1,
        timeMinutes: 0,
        effects: [
          { op: "item.add", id: "empty-wrapper", holder: "$source" },
          { op: "stat.add", id: "satiety", value: 20 },
        ],
      }],
    }, {
      id: "card",
      label: "Instruction card",
      carrying: "unique",
      actions: [{
        id: "read",
        label: "Read card",
        consume: 0,
        timeMinutes: 0,
        effects: [
          { op: "flag.set", id: "hydro.startup_card_read" },
          { op: "flag.set", id: "hydro.discovered" },
          { op: "document.mark-read", id: "startup-card" },
        ],
        view: {
          kind: "document",
          id: "startup-card",
          documentType: "hydro-startup-card",
        },
      }],
    }],
    stats: [{
      id: "satiety",
      label: "Satiety",
      type: "meter",
      default: 25,
      min: 0,
      max: 100,
      drift: { perGameHour: { resting: -3 } },
    }, {
      id: "hydration",
      label: "Hydration",
      type: "meter",
      default: 0,
      min: 0,
      max: 100,
    }],
    knowledge: [], skills: [], quests: [], documents: [{
      id: "startup-card",
      title: "Startup card",
    }],
  });
  addItem(character.holdings, character.definitions, "pack", 1);
  const packInstanceId = Object.entries(character.holdings.instances)
    .find(([, instance]) => instance.item === "pack")?.[0];
  const packHolderId = `container:${packInstanceId}`;
  addItem(character.holdings, character.definitions, "meal", 2);
  addItem(character.holdings, character.definitions, "snack", 1, { holderId: packHolderId });
  addItem(character.holdings, character.definitions, "card", 1);
  return { character, flags: new Set(), clock: createGameClock(), packHolderId };
}

describe("item actions", () => {
  it("atomically consumes an item, applies effects, and advances authored time", () => {
    const gameState = state();
    expect(performItemAction(gameState, "meal", "eat").ok).toBe(true);
    expect(itemQuantity(gameState.character.holdings, "meal")).toBe(1);
    expect(gameState.character.stats.satiety).toBeCloseTo(79);
    expect(gameState.clock.elapsedMinutes).toBe(20);
  });

  it("does not advance time when consumption fails", () => {
    const gameState = state();
    gameState.character.holdings.stacks = {};
    expect(performItemAction(gameState, "meal", "eat").ok).toBe(false);
    expect(gameState.clock.elapsedMinutes).toBe(0);
  });

  it("returns authored stage views after applying read effects", () => {
    const gameState = state();
    const result = performItemAction(gameState, "card", "read");

    expect(result).toEqual({
      ok: true,
      view: {
        kind: "document",
        id: "startup-card",
        documentType: "hydro-startup-card",
      },
    });
    expect(gameState.flags.has("hydro.startup_card_read")).toBe(true);
    expect(gameState.flags.has("hydro.discovered")).toBe(true);
    expect(gameState.character.documents["startup-card"].readAt).toBeTruthy();
    expect(gameState.clock.elapsedMinutes).toBe(0);
  });

  it("can replace a consumed carried item in its source holder", () => {
    const gameState = state();
    const result = performItemAction(gameState, "snack", "eat", {
      holderId: gameState.packHolderId,
    });

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(itemQuantity(gameState.character.holdings, "snack", {
      holderId: gameState.packHolderId,
    })).toBe(0);
    expect(itemQuantity(gameState.character.holdings, "empty-wrapper", {
      holderId: gameState.packHolderId,
    })).toBe(1);
    expect(gameState.character.stats.satiety).toBeCloseTo(45);
  });

  it("scales partial consumable effects and depletes only when empty", () => {
    const gameState = state();
    addItem(gameState.character.holdings, gameState.character.definitions, "bottle", 1);
    const bottle = Object.entries(gameState.character.holdings.instances)
      .find(([, instance]) => instance.item === "bottle");
    bottle[1].remaining = 0.5;

    expect(performItemAction(gameState, "bottle", "drink", {
      recordId: bottle[0],
      holderId: bottle[1].holder,
      optionId: "sip",
    }).ok).toBe(true);
    expect(gameState.character.stats.hydration).toBe(25);
    expect(gameState.character.holdings.instances[bottle[0]].remaining).toBe(0.25);
    expect(itemQuantity(gameState.character.holdings, "empty-bottle")).toBe(0);

    expect(performItemAction(gameState, "bottle", "drink", {
      recordId: bottle[0],
      holderId: bottle[1].holder,
      optionId: "all",
    }).ok).toBe(true);
    expect(gameState.character.stats.hydration).toBe(50);
    expect(itemQuantity(gameState.character.holdings, "bottle")).toBe(0);
    expect(itemQuantity(gameState.character.holdings, "empty-bottle")).toBe(1);
  });

});
