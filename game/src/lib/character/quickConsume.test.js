import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createGameClock } from "./gameTime.js";
import { addItem, characterHolderId, ensureWorldHolder, itemQuantity } from "./holdings.js";
import { performQuickConsume } from "./quickConsume.js";

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
        timeMinutes: 0,
        activity: "resting",
        effects: [{ op: "stat.add", id: "satiety", value: 20 }],
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
    }],
    stats: [{
      id: "satiety",
      type: "meter",
      default: 20,
      min: 0,
      max: 100,
    }, {
      id: "hydration",
      type: "meter",
      default: 20,
      min: 0,
      max: 100,
    }],
    knowledge: [],
    skills: [],
    quests: [],
    documents: [],
  });
  return { character, flags: new Set(), clock: createGameClock() };
}

describe("quick consume", () => {
  it("eats the first carried meal and reports where it came from", () => {
    const gameState = state();
    addItem(gameState.character.holdings, gameState.character.definitions, "meal", 1);
    const result = performQuickConsume(gameState, "eat");
    expect(result.ok).toBe(true);
    expect(result.notice).toMatch(/eat the Meal/i);
    expect(result.notice).toMatch(/holding/i);
    expect(gameState.character.stats.satiety).toBeCloseTo(40);
    expect(itemQuantity(gameState.character.holdings, "meal")).toBe(0);
  });

  it("prefers inventory over the ground", () => {
    const gameState = state();
    addItem(gameState.character.holdings, gameState.character.definitions, "meal", 1);
    const ground = ensureWorldHolder(gameState.character.holdings, {
      place: "outdoors",
      hex: "camp",
    });
    addItem(gameState.character.holdings, gameState.character.definitions, "meal", 1, {
      holderId: ground,
    });

    const result = performQuickConsume(gameState, "eat", { nearbyHolderIds: [ground] });
    expect(result.ok).toBe(true);
    expect(result.notice).toMatch(/holding/i);
    expect(itemQuantity(gameState.character.holdings, "meal", {
      holderId: characterHolderId(gameState.character.holdings),
    })).toBe(0);
    expect(itemQuantity(gameState.character.holdings, "meal", { holderId: ground })).toBe(1);
  });

  it("picks up ground food when nothing is carried", () => {
    const gameState = state();
    const ground = ensureWorldHolder(gameState.character.holdings, {
      place: "outdoors",
      hex: "camp",
    });
    addItem(gameState.character.holdings, gameState.character.definitions, "meal", 1, {
      holderId: ground,
    });

    const result = performQuickConsume(gameState, "eat", { nearbyHolderIds: [ground] });
    expect(result.ok).toBe(true);
    expect(result.notice).toMatch(/Meal/i);
    expect(gameState.character.stats.satiety).toBeCloseTo(40);
  });

  it("drinks from a carried bottle", () => {
    const gameState = state();
    addItem(gameState.character.holdings, gameState.character.definitions, "bottle", 1);
    const result = performQuickConsume(gameState, "drink");
    expect(result.ok).toBe(true);
    expect(result.notice).toMatch(/drink/i);
    expect(gameState.character.stats.hydration).toBeGreaterThan(20);
  });

  it("reports when nothing is in reach", () => {
    const gameState = state();
    expect(performQuickConsume(gameState, "eat").error).toMatch(/no food/i);
    expect(performQuickConsume(gameState, "drink").error).toMatch(/no drink/i);
  });

  it("softly refuses food when already full", () => {
    const gameState = state();
    gameState.character.stats.satiety = 100;
    addItem(gameState.character.holdings, gameState.character.definitions, "meal", 1);
    const result = performQuickConsume(gameState, "eat");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not hungry/i);
  });
});
