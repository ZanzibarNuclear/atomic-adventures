// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import ContainerContentsDialog from "./ContainerContentsDialog.vue";

describe("ContainerContentsDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lists only container contents and takes one meal by default", async () => {
    const meal = {
      type: "stack",
      id: "stack-meal-1",
      item: "tastee-tack-turkey-cranberry-meal",
      label: "Tastee Tack: Turkey Cranberry Dinner",
      quantity: 14,
      icon: null,
      description: "Shelf-stable ration.",
    };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const wrapper = mount(ContainerContentsDialog, {
      attachTo: host,
      props: {
        containerLabel: "Box of Tastee Tack meals",
        locationLabel: "Kitchen · cabinets",
        contents: [meal],
        selectedHolding: meal,
        selectedHoldingId: "stack:stack-meal-1",
        characterHolderId: "character:zanzibar",
        publicAssetPath: (path) => path,
      },
    });

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toContain("Looking inside");
    expect(bodyText).toContain("Box of Tastee Tack meals");
    expect(bodyText).toContain("Take items out. The container stays where it is.");
    expect(bodyText).not.toContain("Items within reach");

    const takeOne = Array.from(document.body.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Take one"));
    expect(takeOne).toBeTruthy();
    await takeOne.click();
    expect(wrapper.emitted("transfer-item")?.[0]?.[0]).toMatchObject({
      type: "stack",
      recordId: "stack-meal-1",
      quantity: 1,
      toHolder: "character:zanzibar",
    });
    wrapper.unmount();
  });
});
