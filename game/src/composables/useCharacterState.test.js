import { describe, expect, it } from "vitest";
import {
  applyCharacterState,
  captureCharacterState,
  characterItems,
  createCharacterState,
  syncCharacterDefinitions,
} from "./useCharacterState.js";

const definitions = {
  items: [
    { id: "known-key", label: "Known key" },
    { id: "ration", label: "Ration" },
  ],
  stats: [{ id: "health", default: 100 }],
};

describe("character state", () => {
  it("backs a Set-like inventory with serializable holdings", () => {
    const state = createCharacterState(definitions);
    state.inventory.add("known-key");

    expect(state.inventory.has("known-key")).toBe(true);
    expect([...state.inventory]).toEqual(["known-key"]);
    expect(captureCharacterState(state).holdings).toEqual({
      items: { "known-key": { quantity: 1 } },
    });
    expect(state.stats.health).toBe(100);
  });

  it("preserves holdings across definition refreshes and tracks orphans", () => {
    const state = createCharacterState(definitions);
    state.inventory.add("known-key");
    state.inventory.add("missing-item");

    syncCharacterDefinitions(state, {
      ...definitions,
      items: [{ id: "ration", label: "Updated ration" }],
    });

    expect(state.inventory.has("known-key")).toBe(true);
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
      skills: { operator: { rank: 1 } },
      quests: { restore: { status: "active" } },
      documents: { manual: { discoveredAt: "now" } },
    });

    expect(captureCharacterState(state)).toEqual({
      holdings: { items: { ration: { quantity: 2 } } },
      stats: { health: 80 },
      knowledge: { hydro: { acquiredAt: "now" } },
      skills: { operator: { rank: 1 } },
      quests: { restore: { status: "active" } },
      documents: { manual: { discoveredAt: "now" } },
    });
  });
});
