// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import InventoryBrowser from "./InventoryBrowser.vue";

function mountBrowser({ selectedHolding, holders, transferTargets, actionFeedback = "" }) {
  return mount(InventoryBrowser, {
    props: {
      holders,
      selectedHolding,
      selectedHoldingId: selectedHolding ? `${selectedHolding.type}:${selectedHolding.id}` : null,
      transferTargets,
      publicAssetPath: (path) => path,
      actionPolicy: { unrestricted: true },
      actionFeedback,
    },
  });
}

const carriedHolder = { id: "character:zanzibar", kind: "character", label: "Holding" };
const groundHolder = { id: "world:indoors:library:desk", kind: "world", label: "Within reach" };
const consoleHolder = {
  id: "fixed:control-room-console",
  kind: "fixed",
  label: "Control-room console",
  accepts: { kinds: ["card"] },
};

describe("InventoryBrowser transfers", () => {
  it("does not reveal numeric wellbeing changes in item details", () => {
    const selectedHolding = {
      type: "catalog",
      id: "energy-bar",
      item: "energy-bar",
      label: "Energy bar",
      quantity: 1,
      holder: carriedHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding,
      holders: [{ ...carriedHolder, records: [selectedHolding] }],
      transferTargets: [carriedHolder],
      actionFeedback: "Energy +30 (40 → 70)",
    });

    expect(wrapper.text()).not.toContain("Energy +30 (40 → 70)");
  });

  it("offers to put carried items down at the current location", async () => {
    const selectedHolding = {
      type: "instance",
      id: "key-1",
      item: "key",
      label: "Brass key",
      quantity: 1,
      holder: carriedHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding,
      holders: [
        { ...carriedHolder, records: [selectedHolding] },
        { ...groundHolder, records: [] },
      ],
      transferTargets: [carriedHolder, groundHolder],
    });

    const button = wrapper.findAll("button").find((candidate) => candidate.text() === "Put down");
    expect(button?.exists()).toBe(true);
    await button.trigger("click");
    expect(wrapper.emitted("transfer-item")?.[0]?.[0]).toMatchObject({
      type: "instance",
      recordId: "key-1",
      itemId: "key",
      quantity: 1,
      toHolder: groundHolder.id,
    });
  });

  it("puts a carried item on the only compatible fixture at the active stand", async () => {
    const selectedHolding = {
      type: "instance",
      id: "laminated-card-1",
      item: "laminated-card",
      label: "Laminated card",
      kind: "card",
      quantity: 1,
      holder: carriedHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding,
      holders: [
        { ...carriedHolder, records: [selectedHolding] },
        { ...groundHolder, records: [] },
        { ...consoleHolder, records: [] },
      ],
      transferTargets: [carriedHolder, groundHolder, consoleHolder],
    });

    // Sole reachable surface: place is implied by where the player stands.
    const button = wrapper.findAll("button")
      .find((candidate) => candidate.text() === "Put down");
    expect(button?.exists()).toBe(true);
    await button.trigger("click");
    expect(wrapper.emitted("transfer-item")?.[0]?.[0]).toMatchObject({
      recordId: "laminated-card-1",
      toHolder: consoleHolder.id,
    });
    expect(wrapper.text()).not.toContain("Put down on Control-room console");
    expect(wrapper.text()).not.toContain("Move to Control-room console");
  });

  it("offers named surfaces and the floor when several fixtures accept a carried item", () => {
    const tableHolder = {
      id: "fixed:conference-table",
      kind: "fixed",
      label: "Conference table",
      accepts: { kinds: ["card"] },
    };
    const counterHolder = {
      id: "fixed:kitchen-counter",
      kind: "fixed",
      label: "Kitchen counter",
      accepts: { kinds: ["card"] },
    };
    const selectedHolding = {
      type: "instance",
      id: "laminated-card-1",
      item: "laminated-card",
      label: "Laminated card",
      kind: "card",
      quantity: 1,
      holder: carriedHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding,
      holders: [
        { ...carriedHolder, records: [selectedHolding] },
        { ...groundHolder, records: [] },
        { ...tableHolder, records: [] },
        { ...counterHolder, records: [] },
      ],
      transferTargets: [carriedHolder, groundHolder, tableHolder, counterHolder],
    });

    const labels = wrapper.findAll("button").map((button) => button.text());
    expect(labels).toEqual(expect.arrayContaining([
      "Put down",
      "Put down on Conference table",
      "Put down on Kitchen counter",
    ]));
    // Verbose fixed-holder prefixes drop in multi-surface labels.
    const verboseConsole = {
      id: "fixed:control-room-console",
      kind: "fixed",
      label: "Control-room console",
      accepts: { kinds: ["card"] },
    };
    const withConsole = mountBrowser({
      selectedHolding,
      holders: [
        { ...carriedHolder, records: [selectedHolding] },
        { ...groundHolder, records: [] },
        { ...tableHolder, records: [] },
        { ...verboseConsole, records: [] },
      ],
      transferTargets: [carriedHolder, groundHolder, tableHolder, verboseConsole],
    });
    expect(withConsole.findAll("button").map((button) => button.text()))
      .toEqual(expect.arrayContaining(["Put down on console"]));
  });

  it("does not repeat an item's related document in its details", () => {
    const selectedHolding = {
      type: "instance",
      id: "laminated-card-1",
      item: "laminated-card",
      label: "Laminated card",
      quantity: 1,
      relatedDocument: "hydro-startup-instruction-card",
      holder: carriedHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding,
      holders: [{ ...carriedHolder, records: [selectedHolding] }],
      transferTargets: [carriedHolder],
    });

    expect(wrapper.text()).not.toContain("Related document:");
  });

  it("offers to pick up nearby items from the current location", async () => {
    const selectedHolding = {
      type: "instance",
      id: "key-1",
      item: "key",
      label: "Brass key",
      quantity: 1,
      holder: groundHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding,
      holders: [
        { ...carriedHolder, records: [] },
        { ...groundHolder, records: [selectedHolding] },
        { ...consoleHolder, records: [] },
      ],
      transferTargets: [carriedHolder, groundHolder, consoleHolder],
    });

    const button = wrapper.findAll("button").find((candidate) => candidate.text() === "Pick up");
    expect(button?.exists()).toBe(true);
    await button.trigger("click");
    expect(wrapper.emitted("transfer-item")?.[0]?.[0]).toMatchObject({
      type: "instance",
      recordId: "key-1",
      itemId: "key",
      quantity: 1,
      toHolder: carriedHolder.id,
    });
    expect(wrapper.text()).not.toContain("Move to Control-room console");
  });

  it("lets the player take items from a container still on a fixed surface", async () => {
    const cabinetsHolder = {
      id: "fixed:kitchen-cabinets",
      kind: "fixed",
      label: "cabinets",
    };
    const boxHolder = {
      id: "container:box-1",
      kind: "container",
      label: "Box of Tastee Tack meals",
      instance: "box-1",
    };
    const boxInstance = {
      type: "instance",
      id: "box-1",
      item: "tastee-tack-box",
      label: "Box of Tastee Tack meals",
      quantity: 1,
      holder: cabinetsHolder,
    };
    const mealStack = {
      type: "stack",
      id: "stack-meal-1",
      item: "tastee-tack-turkey-cranberry-meal",
      label: "Tastee Tack: Turkey Cranberry Dinner",
      quantity: 14,
      holder: boxHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding: mealStack,
      holders: [
        { ...carriedHolder, records: [] },
        { ...cabinetsHolder, records: [boxInstance] },
        { ...boxHolder, records: [mealStack] },
      ],
      transferTargets: [carriedHolder],
    });

    expect(wrapper.text()).toContain("container stays put");
    const takeOne = wrapper.findAll("button").find((candidate) => candidate.text().includes("Take one"));
    expect(takeOne?.exists()).toBe(true);
    await takeOne.trigger("click");
    expect(wrapper.emitted("transfer-item")?.[0]?.[0]).toMatchObject({
      type: "stack",
      recordId: "stack-meal-1",
      quantity: 1,
      toHolder: carriedHolder.id,
    });
  });

  it("takes one stack item out of a container by default, with take-all available", async () => {
    const boxHolder = {
      id: "container:box-1",
      kind: "container",
      label: "Tastee Tack box",
      instance: "box-1",
    };
    const mealStack = {
      type: "stack",
      id: "stack-meal-1",
      item: "tastee-tack-turkey-cranberry-meal",
      label: "Tastee Tack: Turkey Cranberry Dinner",
      quantity: 14,
      holder: boxHolder,
    };
    const boxInstance = {
      type: "instance",
      id: "box-1",
      item: "tastee-tack-box",
      label: "Box of Tastee Tack meals",
      quantity: 1,
      holder: carriedHolder,
    };
    const wrapper = mountBrowser({
      selectedHolding: mealStack,
      holders: [
        { ...carriedHolder, records: [boxInstance] },
        { ...boxHolder, records: [mealStack] },
      ],
      transferTargets: [carriedHolder],
    });

    const takeOne = wrapper.findAll("button").find((candidate) => candidate.text().includes("Take one"));
    const takeAll = wrapper.findAll("button").find((candidate) => candidate.text().includes("Take all (14)"));
    expect(takeOne?.exists()).toBe(true);
    expect(takeAll?.exists()).toBe(true);

    await takeOne.trigger("click");
    expect(wrapper.emitted("transfer-item")?.[0]?.[0]).toMatchObject({
      type: "stack",
      recordId: "stack-meal-1",
      quantity: 1,
      toHolder: carriedHolder.id,
    });

    await takeAll.trigger("click");
    expect(wrapper.emitted("transfer-item")?.[1]?.[0]).toMatchObject({
      type: "stack",
      recordId: "stack-meal-1",
      quantity: 14,
      toHolder: carriedHolder.id,
    });
  });
});
