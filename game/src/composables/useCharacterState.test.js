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
    {
      id: "pack",
      label: "Pack",
      carrying: "unique",
      maxQuantity: 1,
      container: { capacity: { slots: 4 }, accepts: { kinds: ["item"] } },
    },
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
          label: "Holding",
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

  it("starts and resets from authored holdings", () => {
    const state = createCharacterState({
      ...definitions,
      profile: { id: "zanzibar" },
      holdings: {
        holders: {
          "character:zanzibar": { id: "character:zanzibar", kind: "character", label: "Holding" },
          "container:pack-1": { id: "container:pack-1", kind: "container", label: "Pack", instance: "pack-1" },
        },
        instances: {
          "pack-1": { item: "pack", holder: "character:zanzibar" },
        },
        stacks: {
          "stack-ration-2": { item: "ration", quantity: 2, holder: "container:pack-1" },
        },
        nextId: 3,
      },
    });

    expect(itemQuantity(state.holdings, "pack")).toBe(1);
    expect(itemQuantity(state.holdings, "ration")).toBe(2);
    addItem(state.holdings, state.definitions, "known-key");

    resetCharacterState(state);

    expect(itemQuantity(state.holdings, "known-key")).toBe(0);
    expect(itemQuantity(state.holdings, "pack")).toBe(1);
    expect(itemQuantity(state.holdings, "ration")).toBe(2);
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

  it("merges newly authored placed holdings into existing saves", () => {
    const state = createCharacterState(definitions);
    applyCharacterState(state, {
      holdings: {
        holders: {
          "character:player": { id: "character:player", kind: "character", label: "Holding" },
        },
        stacks: {},
        instances: {},
        nextId: 1,
      },
    });

    syncCharacterDefinitions(state, {
      ...definitions,
      items: [
        ...definitions.items,
        { id: "startup-card", label: "Startup card", carrying: "unique", maxQuantity: 1 },
      ],
      holdings: {
        holders: {
          "fixed:console": {
            id: "fixed:console",
            kind: "fixed",
            label: "Console",
            location: { room: "control-room", stand: "console" },
          },
        },
        instances: {
          "startup-card-1": { item: "startup-card", holder: "fixed:console" },
        },
        stacks: {},
        nextId: 2,
      },
    });

    expect(itemQuantity(state.holdings, "startup-card", { holderId: "fixed:console" })).toBe(1);
  });

  it("does not respawn an authored unique item after the player has moved it", () => {
    const state = createCharacterState(definitions);
    applyCharacterState(state, {
      holdings: {
        holders: {
          "character:player": { id: "character:player", kind: "character", label: "Holding" },
        },
        stacks: {},
        instances: {
          "startup-card-1": { item: "startup-card", holder: "character:player" },
        },
        nextId: 2,
      },
    });

    syncCharacterDefinitions(state, {
      ...definitions,
      items: [
        ...definitions.items,
        { id: "startup-card", label: "Startup card", carrying: "unique", maxQuantity: 1 },
      ],
      holdings: {
        holders: {
          "fixed:console": {
            id: "fixed:console",
            kind: "fixed",
            label: "Console",
            location: { room: "control-room", stand: "console" },
          },
        },
        instances: {
          "startup-card-1": { item: "startup-card", holder: "fixed:console" },
        },
        stacks: {},
        nextId: 2,
      },
    });

    expect(itemQuantity(state.holdings, "startup-card", { holderId: "character:player" })).toBe(1);
    expect(itemQuantity(state.holdings, "startup-card", { holderId: "fixed:console" })).toBe(0);
  });

  it("does not respawn a consumed authored item when reloading a save", () => {
    // Reproduces: eat neutron bar (wrapper remains), save, switch games, reload —
    // mergeAuthored used to re-insert the bar into the backpack.
    const withBar = {
      ...definitions,
      items: [
        ...definitions.items,
        { id: "neutron-bar", label: "Neutron Energy Bar", carrying: "unique", maxQuantity: 1 },
        { id: "empty-wrapper", label: "Empty wrapper", carrying: "unique", maxQuantity: 1 },
      ],
      holdings: {
        holders: {
          "character:player": { id: "character:player", kind: "character", label: "Holding" },
          "instance:pack-1": {
            id: "instance:pack-1",
            kind: "container",
            label: "Pack",
          },
        },
        instances: {
          "pack-1": { item: "pack", holder: "character:player" },
          "neutron-bar-1": { item: "neutron-bar", holder: "instance:pack-1" },
        },
        stacks: {},
        nextId: 3,
      },
    };
    const state = createCharacterState(withBar);

    // After eating: bar gone, wrapper held, nextId past the bar id.
    applyCharacterState(state, {
      holdings: {
        holders: {
          "character:player": { id: "character:player", kind: "character", label: "Holding" },
          "instance:pack-1": {
            id: "instance:pack-1",
            kind: "container",
            label: "Pack",
          },
        },
        instances: {
          "pack-1": { item: "pack", holder: "character:player" },
          "empty-wrapper-2": { item: "empty-wrapper", holder: "character:player" },
        },
        stacks: {},
        nextId: 3,
      },
    }, { mergeAuthored: false });

    expect(itemQuantity(state.holdings, "neutron-bar")).toBe(0);
    expect(itemQuantity(state.holdings, "empty-wrapper")).toBe(1);

    // Live authoring refresh must not resurrect the eaten bar.
    syncCharacterDefinitions(state, withBar);
    expect(itemQuantity(state.holdings, "neutron-bar")).toBe(0);
    expect(itemQuantity(state.holdings, "empty-wrapper")).toBe(1);

    // Save/load path (mergeAuthored false on apply) stays authoritative.
    const snap = captureCharacterState(state);
    applyCharacterState(state, snap);
    expect(itemQuantity(state.holdings, "neutron-bar")).toBe(0);
    expect(itemQuantity(state.holdings, "empty-wrapper")).toBe(1);
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
