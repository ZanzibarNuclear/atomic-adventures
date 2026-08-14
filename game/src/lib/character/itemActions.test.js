import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createGameClock } from "./gameTime.js";
import { addItem, characterHolderId, itemQuantity, transferHolding } from "./holdings.js";
import {
  consumeOptionLabel,
  isConsumeOptionOffered,
  performItemAction,
  presentConsumeOptions,
} from "./itemActions.js";

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

describe("consume option presentation", () => {
  const options = [
    { id: "nibble", label: "Nibble", portion: 0.25 },
    { id: "half", label: "Eat half", portion: 0.5 },
    { id: "all", label: "Eat all remaining", remaining: true },
  ];
  const action = { id: "eat", label: "Eat", consumeOptions: options };

  it("drops trailing remaining from all-out labels", () => {
    expect(consumeOptionLabel({ label: "Eat all remaining", remaining: true })).toBe("Eat all");
    expect(consumeOptionLabel({ label: "Drink all remaining", remaining: true })).toBe("Drink all");
    expect(consumeOptionLabel({ label: "Eat half", portion: 0.5 })).toBe("Eat half");
  });

  it("hides half when leftover is at or below half of a full item", () => {
    expect(isConsumeOptionOffered(options[1], 1)).toBe(true);
    expect(isConsumeOptionOffered(options[1], 0.5)).toBe(false);
    expect(isConsumeOptionOffered(options[1], 0.4)).toBe(false);
  });

  it("keeps nibble available even when it would finish the rest", () => {
    expect(isConsumeOptionOffered(options[0], 0.2)).toBe(true);
    expect(isConsumeOptionOffered(options[0], 0.25)).toBe(true);
  });

  it("always offers all when anything remains", () => {
    expect(isConsumeOptionOffered(options[2], 0.5)).toBe(true);
    expect(isConsumeOptionOffered(options[2], 0.01)).toBe(true);
    expect(isConsumeOptionOffered(options[2], 0)).toBe(false);
  });

  it("presents the visible labeled choices for a half-eaten item", () => {
    const choices = presentConsumeOptions(action, 0.5);
    expect(choices.map((entry) => entry.buttonLabel)).toEqual(["Nibble", "Eat all"]);
  });
});

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
      notice: null,
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

  it("requires holding a consumable before consuming it", () => {
    const gameState = state();
    const result = performItemAction(gameState, "snack", "eat", {
      holderId: gameState.packHolderId,
    });

    expect(result).toEqual({ ok: false, error: "Hold the item before consuming it." });
    expect(itemQuantity(gameState.character.holdings, "snack", {
      holderId: gameState.packHolderId,
    })).toBe(1);
    expect(itemQuantity(gameState.character.holdings, "empty-wrapper", {
      holderId: gameState.packHolderId,
    })).toBe(0);
  });

  it("can replace a consumed held item in its source holder", () => {
    const gameState = state();
    const snack = Object.entries(gameState.character.holdings.instances)
      .find(([, instance]) => instance.item === "snack");
    transferHolding(gameState.character.holdings, gameState.character.definitions, {
      type: "instance",
      id: snack[0],
      toHolder: characterHolderId(gameState.character.holdings),
    });
    const result = performItemAction(gameState, "snack", "eat", {
      holderId: characterHolderId(gameState.character.holdings),
    });

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(itemQuantity(gameState.character.holdings, "snack", {
      holderId: characterHolderId(gameState.character.holdings),
    })).toBe(0);
    expect(itemQuantity(gameState.character.holdings, "empty-wrapper", {
      holderId: characterHolderId(gameState.character.holdings),
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

  it("lets the player nibble a stacked meal and leaves a partial meal instance", () => {
    const gameState = state();
    gameState.character.definitions.items.find((item) => item.id === "meal").actions = [{
      id: "eat",
      label: "Eat meal",
      consume: 0,
      consumeOptions: [
        { id: "nibble", label: "Nibble", portion: 0.25 },
        { id: "all", label: "Eat all remaining", remaining: true },
      ],
      timeMinutes: 0,
      activity: "resting",
      effects: [{ op: "stat.add", id: "satiety", value: 40, scaleBy: "portion" }],
    }];
    gameState.character.stats.satiety = 20;

    expect(performItemAction(gameState, "meal", "eat", { optionId: "nibble" }).ok).toBe(true);
    expect(itemQuantity(gameState.character.holdings, "meal")).toBe(2); // 1 whole + 1 partial
    const partial = Object.values(gameState.character.holdings.instances)
      .find((instance) => instance.item === "meal");
    expect(partial?.remaining).toBeCloseTo(0.75);
    expect(gameState.character.stats.satiety).toBeCloseTo(30);
  });

  it("tops off satiety with a partial meal instead of refusing when already nearly full", () => {
    const gameState = state();
    gameState.character.definitions.items.find((item) => item.id === "meal").actions = [{
      id: "eat",
      label: "Eat",
      consume: 1,
      timeMinutes: 0,
      activity: "resting",
      effects: [{ op: "stat.add", id: "satiety", value: 55 }],
    }];
    gameState.character.definitions.stats.find((stat) => stat.id === "satiety").displayStates = [
      { at: 90, state: "Stuffed", tone: "positive" },
      { at: 0, state: "Hungry", tone: "warning" },
    ];
    gameState.character.stats.satiety = 95;

    const result = performItemAction(gameState, "meal", "eat");
    expect(result.ok).toBe(true);
    expect(result.notice == null || result.notice === "").toBe(true);
    expect(gameState.character.stats.satiety).toBeCloseTo(100);
    // One whole meal becomes a leftover partial (55 → need 5 → ~0.09 spent).
    expect(itemQuantity(gameState.character.holdings, "meal")).toBe(2);
    const partial = Object.values(gameState.character.holdings.instances)
      .find((instance) => instance.item === "meal");
    expect(partial?.remaining).toBeCloseTo(50 / 55, 3);
  });

  it("softly refuses food when satiety is already maxed", () => {
    const gameState = state();
    gameState.character.stats.satiety = 100;

    const result = performItemAction(gameState, "meal", "eat");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not hungry/i);
    expect(itemQuantity(gameState.character.holdings, "meal")).toBe(2);
    expect(gameState.character.stats.satiety).toBe(100);
  });

  it("tops off hydration when already in the hydrated band but under max", () => {
    const gameState = state();
    gameState.character.definitions.stats.find((stat) => stat.id === "hydration").displayStates = [
      { at: 80, state: "Hydrated", tone: "positive" },
      { at: 0, state: "Thirsty", tone: "warning" },
    ];
    gameState.character.stats.hydration = 90;
    addItem(gameState.character.holdings, gameState.character.definitions, "bottle", 1);
    const bottle = Object.entries(gameState.character.holdings.instances)
      .find(([, record]) => record.item === "bottle");

    const result = performItemAction(gameState, "bottle", "drink", {
      recordId: bottle[0],
      holderId: bottle[1].holder,
      optionId: "all",
    });
    expect(result.ok).toBe(true);
    expect(result.notice == null || result.notice === "").toBe(true);
    expect(gameState.character.stats.hydration).toBeCloseTo(100);
    // 10% of a full bottle tops off; 90% remains.
    expect(gameState.character.holdings.instances[bottle[0]].remaining).toBeCloseTo(0.9);
  });

  it("softly refuses drink when hydration is already maxed", () => {
    const gameState = state();
    gameState.character.stats.hydration = 100;
    addItem(gameState.character.holdings, gameState.character.definitions, "bottle", 1);
    const bottle = Object.entries(gameState.character.holdings.instances)
      .find(([, record]) => record.item === "bottle");

    const result = performItemAction(gameState, "bottle", "drink", {
      recordId: bottle[0],
      holderId: bottle[1].holder,
      optionId: "all",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not thirsty/i);
    expect(gameState.character.stats.hydration).toBe(100);
  });

  it("allows eating food that also adds a little hydration when already hydrated", () => {
    const gameState = state();
    gameState.character.definitions.items.find((item) => item.id === "meal").actions = [{
      id: "eat",
      label: "Eat meal",
      consume: 1,
      timeMinutes: 0,
      activity: "resting",
      effects: [
        { op: "stat.add", id: "satiety", value: 55 },
        { op: "stat.add", id: "hydration", value: 4 },
      ],
    }];
    gameState.character.definitions.stats.find((stat) => stat.id === "hydration").displayStates = [
      { at: 80, state: "Hydrated", tone: "positive" },
      { at: 0, state: "Thirsty", tone: "warning" },
    ];
    gameState.character.stats.satiety = 20;
    gameState.character.stats.hydration = 95;

    const result = performItemAction(gameState, "meal", "eat");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(gameState.character.stats.satiety).toBeCloseTo(75);
  });

});
