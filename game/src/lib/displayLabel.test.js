import { describe, expect, it } from "vitest";
import { inventoryHolderHeading, isRedundantWorldHolder } from "./displayLabel.js";

describe("inventoryHolderHeading", () => {
  it("labels the character holder as in-hand, not a world surface", () => {
    expect(inventoryHolderHeading({ kind: "character", label: "Holding" }))
      .toBe("In your hands");
  });

  it("uses the stand label for a fixed holder, not the internal id", () => {
    expect(inventoryHolderHeading({
      id: "fixed:control-room-console",
      kind: "fixed",
      label: "Control-room console",
      shortLabel: "console",
      location: { room: "control-room", stand: "console" },
    })).toBe("On the console");
  });

  it("falls back to the authored stand name when the holder label looks like an id", () => {
    expect(inventoryHolderHeading({
      id: "fixed:control-room-console",
      kind: "fixed",
      label: "Control-room console",
      location: { room: "control-room", stand: "console" },
    }, { id: "console", label: "console" })).toBe("On the console");
  });

  it("hides an empty Within reach bucket when a named stand surface is already listed", () => {
    const world = { id: "world:indoors:control-room:console", kind: "world", label: "Within reach", records: [] };
    const consoleHolder = {
      id: "fixed:control-room-console",
      kind: "fixed",
      location: { stand: "console" },
      records: [],
    };
    expect(isRedundantWorldHolder(world, [world, consoleHolder])).toBe(true);
    expect(isRedundantWorldHolder({ ...world, records: [{ id: "key-1" }] }, [world, consoleHolder])).toBe(false);
  });
});
