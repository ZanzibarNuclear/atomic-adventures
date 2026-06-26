import { describe, expect, it } from "vitest";
import { createCharacterState } from "../../composables/useCharacterState.js";
import { createGameClock } from "./gameTime.js";
import { addItem, itemQuantity } from "./holdings.js";
import { performItemAction } from "./itemActions.js";

function state() {
  const character = createCharacterState({
    items: [{
      id: "meal",
      label: "Meal",
      carrying: "stack",
      maxQuantity: 10,
      actions: [{
        id: "eat",
        label: "Eat",
        consume: 1,
        timeMinutes: 20,
        activity: "resting",
        effects: [{ op: "stat.add", id: "hunger", value: -55 }],
      }],
    }],
    stats: [{
      id: "hunger",
      label: "Hunger",
      type: "meter",
      default: 80,
      min: 0,
      max: 100,
      drift: { perGameHour: { resting: 3 } },
    }],
    knowledge: [], skills: [], quests: [], documents: [],
  });
  addItem(character.holdings, character.definitions, "meal", 2);
  return { character, flags: new Set(), clock: createGameClock() };
}

describe("item actions", () => {
  it("atomically consumes an item, applies effects, and advances authored time", () => {
    const gameState = state();
    expect(performItemAction(gameState, "meal", "eat").ok).toBe(true);
    expect(itemQuantity(gameState.character.holdings, "meal")).toBe(1);
    expect(gameState.character.stats.hunger).toBeCloseTo(26);
    expect(gameState.clock.elapsedMinutes).toBe(20);
  });

  it("does not advance time when consumption fails", () => {
    const gameState = state();
    gameState.character.holdings.stacks = {};
    expect(performItemAction(gameState, "meal", "eat").ok).toBe(false);
    expect(gameState.clock.elapsedMinutes).toBe(0);
  });
});
