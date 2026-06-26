import { describe, expect, it } from "vitest";
import {
  accessibleHolderIds,
  addItem,
  characterHolderId,
  createHoldings,
  ensureWorldHolder,
  holdingRecords,
  itemQuantity,
  moveHolder,
  transferHolding,
} from "./holdings.js";

const definitions = {
  profile: { id: "zanzibar" },
  items: [
    {
      id: "backpack",
      label: "Backpack",
      kind: "container",
      carrying: "unique",
      maxQuantity: 1,
      portable: true,
      container: {
        capacity: { slots: 2, massKg: 5 },
        accepts: { kinds: ["tool", "key"] },
        nesting: false,
      },
    },
    {
      id: "cutter",
      kind: "tool",
      carrying: "unique",
      maxQuantity: 1,
      massKg: 2,
      portable: true,
    },
    {
      id: "key",
      kind: "key",
      carrying: "unique",
      maxQuantity: 2,
      massKg: 0.1,
      portable: true,
    },
    {
      id: "ration",
      kind: "consumable",
      carrying: "stack",
      maxQuantity: 20,
      massKg: 0.5,
      portable: true,
    },
  ],
};

function holdings() {
  return createHoldings("zanzibar", [{
    id: "vehicle:ebuggy",
    kind: "vehicle",
    label: "eBuggy cargo",
    capacity: { slots: 4, massKg: 20 },
  }]);
}

describe("physical item holdings", () => {
  it("moves a container with its contents and preserves access", () => {
    const state = holdings();
    addItem(state, definitions, "backpack");
    addItem(state, definitions, "cutter");
    const backpack = holdingRecords(state, definitions)
      .find((record) => record.item === "backpack");
    const cutter = holdingRecords(state, definitions)
      .find((record) => record.item === "cutter");

    transferHolding(state, definitions, {
      type: "instance",
      id: cutter.id,
      toHolder: `container:${backpack.id}`,
    });
    expect(itemQuantity(state, "cutter")).toBe(1);

    transferHolding(state, definitions, {
      type: "instance",
      id: backpack.id,
      toHolder: "vehicle:ebuggy",
    });
    expect(itemQuantity(state, "cutter")).toBe(0);
    expect(itemQuantity(state, "cutter", {
      access: "nearby",
      nearbyHolderIds: ["vehicle:ebuggy"],
    })).toBe(1);
  });

  it("splits and merges stacks across holders", () => {
    const state = holdings();
    addItem(state, definitions, "ration", 4);
    const stack = holdingRecords(state, definitions)[0];
    transferHolding(state, definitions, {
      type: "stack",
      id: stack.id,
      quantity: 2,
      toHolder: "vehicle:ebuggy",
    });
    expect(itemQuantity(state, "ration")).toBe(2);
    expect(itemQuantity(state, "ration", {
      access: "nearby",
      nearbyHolderIds: ["vehicle:ebuggy"],
    })).toBe(4);
  });

  it("enforces capacity, acceptance, and container cycles", () => {
    const state = holdings();
    addItem(state, definitions, "backpack");
    addItem(state, definitions, "cutter");
    addItem(state, definitions, "key");
    const records = holdingRecords(state, definitions);
    const backpack = records.find((record) => record.item === "backpack");
    const cutter = records.find((record) => record.item === "cutter");
    const key = records.find((record) => record.item === "key");
    transferHolding(state, definitions, {
      type: "instance", id: cutter.id, toHolder: `container:${backpack.id}`,
    });
    transferHolding(state, definitions, {
      type: "instance", id: key.id, toHolder: `container:${backpack.id}`,
    });
    expect(() => addItem(
      state,
      definitions,
      "key",
      1,
      { holderId: `container:${backpack.id}` },
    )).toThrow("no free slots");
    expect(() => transferHolding(state, definitions, {
      type: "instance", id: backpack.id, toHolder: `container:${backpack.id}`,
    })).toThrow("cannot contain itself");
  });

  it("creates stable world placements and reports holder reachability", () => {
    const state = holdings();
    const worldHolder = ensureWorldHolder(state, { place: "indoors", room: "library" });
    addItem(state, definitions, "key", 1, { holderId: worldHolder });
    expect(itemQuantity(state, "key")).toBe(0);
    expect(accessibleHolderIds(state, "nearby", [worldHolder])).toContain(worldHolder);
    expect(characterHolderId(state)).toBe("character:zanzibar");
  });

  it("moves vehicle cargo location without changing cargo contents", () => {
    const state = holdings();
    addItem(state, definitions, "cutter", 1, { holderId: "vehicle:ebuggy" });
    expect(itemQuantity(state, "cutter", {
      access: "nearby",
      nearbyHolderIds: ["vehicle:ebuggy"],
    })).toBe(1);

    moveHolder(state, "vehicle:ebuggy", { hex: "solar-field" });
    expect(state.holders["vehicle:ebuggy"].location).toEqual({ hex: "solar-field" });
    expect(itemQuantity(state, "cutter")).toBe(0);
    expect(itemQuantity(state, "cutter", {
      access: "nearby",
      nearbyHolderIds: ["vehicle:ebuggy"],
    })).toBe(1);
  });
});
