import { describe, expect, it } from "vitest";
import {
  applyCharacterState,
  captureCharacterState,
  characterItems,
  createCharacterState,
  resetCharacterState,
  syncCharacterDefinitions,
} from "./useCharacterState.js";
import { addItem, itemQuantity } from "../lib/character/holdings.js";

const definitions = {
  items: [
    { id: "known-key", label: "Known key" },
    { id: "ration", label: "Ration", carrying: "stack", maxQuantity: 10 },
  ],
  stats: [{ id: "health", default: 100 }],
};

describe("character state", () => {
  it("stores inventory as serializable holdings", () => {
    const state = createCharacterState(definitions);
    addItem(state.holdings, state.definitions, "known-key");

    expect(characterItems(state).map((item) => item.id)).toEqual(["known-key"]);
    expect(captureCharacterState(state).holdings).toEqual({
      holders: {
        "character:player": {
          id: "character:player",
          kind: "character",
          label: "Carried directly",
        },
      },
      stacks: {},
      instances: {
        "known-key-1": { item: "known-key", holder: "character:player" },
      },
      nextId: 2,
    });
    expect(state.stats.health).toBe(100);
  });

  it("preserves holdings across definition refreshes and tracks orphans", () => {
    const state = createCharacterState(definitions);
    addItem(state.holdings, state.definitions, "known-key");
    addItem(state.holdings, state.definitions, "missing-item", 1, {
      validateDefinition: false,
    });

    syncCharacterDefinitions(state, {
      ...definitions,
      items: [{ id: "ration", label: "Updated ration" }],
    });

    expect(itemQuantity(state.holdings, "known-key")).toBe(1);
    expect(state.orphanItemIds).toEqual(["known-key", "missing-item"]);
    expect(characterItems(state).some((item) => item.id === "known-key")).toBe(false);
    expect(characterItems(state, {}, { includeOrphans: true })
      .find((item) => item.id === "known-key")?.orphan).toBe(true);
  });

  it("round-trips all character domains", () => {
    const state = createCharacterState(definitions);
    applyCharacterState(state, {
      holdings: { items: { ration: { quantity: 2 } } },
      stats: { health: 80 },
      knowledge: { hydro: { acquiredAt: "now" } },
      skills: {
        operator: {
          rank: 1,
          evidence: { days: 2 },
          evidenceEvents: { "repair-a": "now" },
          awards: { 1: { earnedAt: "now", earnedText: "Introduced" } },
        },
      },
      quests: { restore: { status: "active" } },
      documents: { manual: { discoveredAt: "now" } },
    });

    expect(captureCharacterState(state)).toEqual({
      holdings: expect.objectContaining({
        stacks: expect.objectContaining({
          "stack-ration-1": { item: "ration", quantity: 2, holder: "character:player" },
        }),
      }),
      stats: { health: 80 },
      knowledge: { hydro: { acquiredAt: "now" } },
      skills: {
        operator: {
          rank: 1,
          evidence: { days: 2 },
          evidenceEvents: { "repair-a": "now" },
          awards: { 1: { earnedAt: "now", earnedText: "Introduced" } },
        },
      },
      quests: { restore: { status: "active" } },
      documents: { manual: { discoveredAt: "now" } },
    });
  });

  it("bumps a revision when managed character state changes", () => {
    const state = createCharacterState(definitions);
    const initial = state.revision;

    syncCharacterDefinitions(state, definitions);
    expect(state.revision).toBe(initial + 1);

    applyCharacterState(state, { stats: { health: 80 } });
    expect(state.revision).toBe(initial + 2);

    resetCharacterState(state);
    expect(state.revision).toBe(initial + 3);
  });
});
