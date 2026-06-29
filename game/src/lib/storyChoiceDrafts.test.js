import { describe, expect, it } from "vitest";
import {
  choiceDestinationType,
  createEmptyChoice,
  setChoiceDestinationType,
  setChoiceViewKind,
} from "./storyChoiceDrafts.js";

const catalog = {
  world: {
    hexes: [{ id: "gate" }],
    rooms: [{ id: "control-room" }],
    exteriorNodes: [{ id: "driveway" }],
    buildings: [{ id: "utility-station" }],
  },
};

describe("story choice drafts", () => {
  it("creates empty choices with stable defaults", () => {
    expect(createEmptyChoice({ id: "choice-1", order: 3 })).toEqual({
      id: "choice-1",
      order: 3,
      text: "",
      timeMinutes: 0,
      timeUntil: null,
      activity: "light",
      sets: [],
      set_flags: [],
      go_hex: null,
      go_room: null,
      go_exterior_node: null,
      enter: null,
      view: null,
    });
  });

  it("detects and switches destination types", () => {
    const choice = createEmptyChoice({ id: "choice" });
    expect(choiceDestinationType(choice)).toBe("");

    setChoiceDestinationType(choice, "hex", catalog);
    expect(choiceDestinationType(choice)).toBe("hex");
    expect(choice.go_hex).toBe("gate");
    expect(choice.go_room).toBeNull();

    setChoiceDestinationType(choice, "room", catalog);
    expect(choiceDestinationType(choice)).toBe("room");
    expect(choice.go_hex).toBeNull();
    expect(choice.go_room).toBe("control-room");

    setChoiceDestinationType(choice, "view", catalog);
    expect(choiceDestinationType(choice)).toBe("view");
    expect(choice.go_room).toBeNull();
    expect(choice.view).toEqual({ kind: "inventory" });
  });

  it("falls back to a building id for enter choices when the catalog is empty", () => {
    const choice = createEmptyChoice({ id: "choice" });
    setChoiceDestinationType(choice, "enter", {
      world: { hexes: [], rooms: [], exteriorNodes: [], buildings: [] },
    });
    expect(choice.enter).toBe("building");
  });

  it("sets view payload defaults", () => {
    const choice = createEmptyChoice({ id: "choice" });
    setChoiceViewKind(choice, "character-stats");
    expect(choice.view).toEqual({ kind: "character-stats", focus: "health" });
    setChoiceViewKind(choice, "inventory");
    expect(choice.view).toEqual({ kind: "inventory" });
  });
});
