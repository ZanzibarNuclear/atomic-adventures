import { describe, expect, it } from "vitest";
import {
  addStartingInstance,
  createFixedHolder,
  ensureHoldings,
  listHolderContents,
  listItemInstances,
  placeContainerAt,
  removeStartingInstance,
  setStackQuantity,
  stockIntoHolder,
} from "./holdingsAuthoring.js";
import { defaultContainerConfig } from "./itemKinds.js";

function draftWithItems(items) {
  return {
    profile: { id: "zanzibar-nuhero" },
    items,
    holdings: null,
  };
}

const box = {
  id: "tastee-tack-box",
  label: "Box of Tastee Tack",
  kind: "container",
  carrying: "unique",
  maxQuantity: 1,
  container: defaultContainerConfig({ slots: 14, kinds: ["consumable"] }),
};

const meal = {
  id: "tastee-tack-turkey-cranberry-meal",
  label: "Turkey meal",
  kind: "consumable",
  carrying: "stack",
  maxQuantity: 20,
};

describe("holdingsAuthoring", () => {
  it("creates a container instance and stocks a meal stack", () => {
    const draft = draftWithItems([box, meal]);
    const holdings = ensureHoldings(draft);
    const instanceId = addStartingInstance(holdings, box);
    expect(listItemInstances(holdings, "tastee-tack-box")).toHaveLength(1);
    expect(holdings.holders[`container:${instanceId}`].capacity.slots).toBe(14);

    stockIntoHolder(holdings, meal, {
      holderId: `container:${instanceId}`,
      quantity: 14,
    });
    const contents = listHolderContents(holdings, `container:${instanceId}`, {
      [meal.id]: meal,
    });
    expect(contents).toEqual([
      expect.objectContaining({
        type: "stack",
        item: meal.id,
        quantity: 14,
      }),
    ]);
  });

  it("merges additional stock into the same stack and allows quantity edits", () => {
    const draft = draftWithItems([box, meal]);
    const holdings = ensureHoldings(draft);
    const instanceId = addStartingInstance(holdings, box);
    const holderId = `container:${instanceId}`;
    const first = stockIntoHolder(holdings, meal, { holderId, quantity: 10 });
    stockIntoHolder(holdings, meal, { holderId, quantity: 4 });
    expect(holdings.stacks[first.id].quantity).toBe(14);
    setStackQuantity(holdings, first.id, 6);
    expect(holdings.stacks[first.id].quantity).toBe(6);
  });

  it("places an instance on a fixed kitchen holder", () => {
    const draft = draftWithItems([box, meal]);
    const holdings = ensureHoldings(draft);
    const fixedId = createFixedHolder(holdings, {
      id: "kitchen-cabinets",
      label: "Kitchen cabinets",
      room: "kitchen",
      stand: "cabinets",
      acceptsKinds: ["container", "consumable"],
    });
    const instanceId = addStartingInstance(holdings, box, { holderId: fixedId });
    expect(holdings.instances[instanceId].holder).toBe("fixed:kitchen-cabinets");
    expect(holdings.holders[fixedId].location).toEqual({
      room: "kitchen",
      stand: "cabinets",
    });
  });

  it("refuses to remove a non-empty container instance", () => {
    const draft = draftWithItems([box, meal]);
    const holdings = ensureHoldings(draft);
    const instanceId = addStartingInstance(holdings, box);
    stockIntoHolder(holdings, meal, {
      holderId: `container:${instanceId}`,
      quantity: 2,
    });
    expect(() => removeStartingInstance(holdings, instanceId)).toThrow(/Empty the container/);
  });

  it("places a stocked container at a room/stand in one step", () => {
    const draft = draftWithItems([box, meal]);
    const holdings = ensureHoldings(draft);
    const { holderId, instanceId } = placeContainerAt(holdings, box, {
      room: "kitchen",
      stand: "cabinets",
      roomLabel: "Kitchen",
      standLabel: "cabinets",
      contentItem: meal,
      contentQuantity: 14,
    });
    expect(holderId).toBe("fixed:kitchen-cabinets");
    expect(holdings.holders[holderId].location).toEqual({
      room: "kitchen",
      stand: "cabinets",
    });
    expect(holdings.instances[instanceId].holder).toBe(holderId);
    const contents = listHolderContents(holdings, `container:${instanceId}`);
    expect(contents[0]).toEqual(expect.objectContaining({
      item: meal.id,
      quantity: 14,
    }));
  });
});
