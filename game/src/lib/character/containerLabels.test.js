import { describe, expect, it } from "vitest";
import {
  containerGroupInspectLabel,
  containerInstanceLabel,
  formatContainerGroupDiscovery,
} from "./containerLabels.js";

const definitions = {
  items: [
    { id: "tastee-tack-box", label: "Box of Tastee Tack meals", container: {} },
    { id: "turkey", label: "Tastee Tack: Turkey Cranberry Dinner" },
    { id: "breakfast", label: "Tastee Tack: Pioneer Breakfast" },
    { id: "nut", label: "Tastee Tack: Nut Butter and Preserves" },
  ],
};

function holdingsWithBoxes() {
  return {
    holders: {
      "container:box-1": { id: "container:box-1", kind: "container", instance: "box-1" },
      "container:box-2": { id: "container:box-2", kind: "container", instance: "box-2" },
      "container:box-3": { id: "container:box-3", kind: "container", instance: "box-3" },
    },
    instances: {
      "box-1": { item: "tastee-tack-box", holder: "fixed:cabinets" },
      "box-2": { item: "tastee-tack-box", holder: "fixed:cabinets" },
      "box-3": { item: "tastee-tack-box", holder: "fixed:cabinets" },
    },
    stacks: {
      "s1": { item: "turkey", quantity: 14, holder: "container:box-1" },
      "s2": { item: "breakfast", quantity: 14, holder: "container:box-2" },
      "s3": { item: "nut", quantity: 14, holder: "container:box-3" },
    },
  };
}

describe("containerLabels", () => {
  it("names each box from its meal flavor", () => {
    const holdings = holdingsWithBoxes();
    expect(containerInstanceLabel(holdings, definitions, "box-1", {
      baseLabel: "Box of Tastee Tack meals",
      itemId: "tastee-tack-box",
    })).toBe("Box of Tastee Tack: Turkey Cranberry Dinner");
    expect(containerInstanceLabel(holdings, definitions, "box-2", {
      itemId: "tastee-tack-box",
    })).toBe("Box of Tastee Tack: Pioneer Breakfast");
  });

  it("groups discovery copy for multiple flavors", () => {
    expect(formatContainerGroupDiscovery("Box of Tastee Tack meals", [
      "Box of Tastee Tack: Turkey Cranberry Dinner",
      "Box of Tastee Tack: Pioneer Breakfast",
      "Box of Tastee Tack: Nut Butter and Preserves",
    ])).toBe(
      "There are 3 boxes of Tastee Tack (Turkey Cranberry Dinner, Pioneer Breakfast, and Nut Butter and Preserves).",
    );
  });

  it("labels the group inspect action", () => {
    expect(containerGroupInspectLabel("Box of Tastee Tack meals", 3))
      .toBe("Inspect the Tastee Tack boxes");
  });
});
