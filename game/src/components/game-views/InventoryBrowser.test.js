// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import InventoryBrowser from "./InventoryBrowser.vue";

function mountBrowser({ selectedHolding, holders, transferTargets }) {
  return mount(InventoryBrowser, {
    props: {
      holders,
      selectedHolding,
      selectedHoldingId: selectedHolding ? `${selectedHolding.type}:${selectedHolding.id}` : null,
      transferTargets,
      publicAssetPath: (path) => path,
      actionPolicy: { unrestricted: true },
    },
  });
}

const carriedHolder = { id: "character:zanzibar", kind: "character", label: "Holding" };
const groundHolder = { id: "world:indoors:library:desk", kind: "world", label: "Within reach" };

describe("InventoryBrowser transfers", () => {
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
      ],
      transferTargets: [carriedHolder, groundHolder],
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
  });
});
