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
        effects: [{ op: "stat.add", id: "satiety", value: 55 }],
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
    }],
    knowledge: [], skills: [], quests: [], documents: [{
      id: "startup-card",
      title: "Startup card",
    }],
  });
  addItem(character.holdings, character.definitions, "meal", 2);
  addItem(character.holdings, character.definitions, "card", 1);
  return { character, flags: new Set(), clock: createGameClock() };
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
    expect(gameState.character.documents["startup-card"].readAt).toBeTruthy();
    expect(gameState.clock.elapsedMinutes).toBe(0);
  });
});
