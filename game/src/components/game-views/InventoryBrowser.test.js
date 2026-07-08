// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import InventoryBrowser from "./InventoryBrowser.vue";

const consumableRecord = {
  type: "instance",
  id: "water-1",
  item: "water",
  label: "Purified water",
  description: "Clean water in a sealed bottle.",
  quantity: 1,
  holder: { id: "container:pack-1", kind: "container", label: "field backpack" },
  actions: [{
    id: "drink",
    label: "Drink",
    consume: 0,
    consumeOptions: [
      { id: "sip", label: "Sip", portion: 0.25 },
      { id: "all", label: "Drink all", remaining: true },
    ],
  }],
};

function mountInventory(selectedHolding) {
  return mount(InventoryBrowser, {
    props: {
      holders: [{
        id: "character:player",
        kind: "character",
        label: "Holding",
        records: [],
      }, {
        id: "container:pack-1",
        kind: "container",
        label: "field backpack",
        instance: "pack-1",
        records: [consumableRecord],
      }],
      selectedHolding,
      selectedHoldingId: `${selectedHolding.type}:${selectedHolding.id}`,
      transferTargets: [{ id: "character:player", kind: "character", label: "Holding" }],
      publicAssetPath: (path) => path,
    },
  });
}

describe("InventoryBrowser actions", () => {
  it("only offers hold/take-out actions for consumables inside a container", () => {
    const wrapper = mountInventory(consumableRecord);

    expect(wrapper.text()).toContain("Take out");
    expect(wrapper.text()).not.toContain("Sip");
    expect(wrapper.text()).not.toContain("Drink all");
  });

  it("offers consume actions once the consumable is held directly", () => {
    const wrapper = mountInventory({
      ...consumableRecord,
      holder: { id: "character:player", kind: "character", label: "Holding" },
    });

    expect(wrapper.text()).toContain("Sip");
    expect(wrapper.text()).toContain("Drink all");
  });
});
