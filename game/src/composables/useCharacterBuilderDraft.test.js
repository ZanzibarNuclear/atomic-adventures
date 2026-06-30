import { describe, expect, it } from "vitest";
import { buildPreviewCharacter } from "./useCharacterBuilderDraft.js";
import { characterWellbeingOverview } from "../lib/character/panel.js";

function draft() {
  return {
    profile: { id: "zanzibar", name: "Zanzibar" },
    panel: { tabs: ["overview"] },
    items: [],
    stats: [
      { id: "health", label: "Health", type: "meter", min: 0, max: 100, default: 100, visible: "always" },
      { id: "satiety", label: "Satiety", type: "meter", min: 0, max: 100, default: 100, visible: "always" },
      { id: "hydration", label: "Hydration", type: "meter", min: 0, max: 100, default: 100, visible: "always" },
      { id: "energy", label: "Energy", type: "meter", min: 0, max: 100, default: 100, visible: "always" },
      { id: "composure", label: "Composure", type: "meter", min: 0, max: 100, default: 100, visible: "always" },
    ],
    knowledge: [],
    skills: [],
    quests: [],
    documents: [],
  };
}

function contentDraft() {
  return {
    ...draft(),
    items: [
      { id: "key", label: "Key", carrying: "unique" },
      { id: "rope", label: "Rope", carrying: "unique" },
    ],
    knowledge: [{ id: "hydro", label: "Hydro" }, { id: "solar", label: "Solar" }],
    skills: [{ id: "repair", label: "Repair" }, { id: "navigation", label: "Navigation" }],
    quests: [{ id: "restore", label: "Restore" }, { id: "survey", label: "Survey" }],
    documents: [{ id: "manual", title: "Manual" }, { id: "map", title: "Map" }],
  };
}

describe("content builder preview character", () => {
  it("sets wellbeing bars to the selected preview level", () => {
    const character = buildPreviewCharacter(draft(), "empty", "low");
    const overview = characterWellbeingOverview(character);

    expect(character.stats).toEqual(expect.objectContaining({
      health: 25,
      satiety: 25,
      hydration: 25,
      energy: 25,
      composure: 25,
    }));
    expect(overview.vitals).toEqual([
      expect.objectContaining({ id: "health", value: 25, state: "Weak" }),
      expect.objectContaining({ id: "satiety", value: 25, state: "Hungry" }),
      expect.objectContaining({ id: "hydration", value: 25, state: "Thirsty" }),
      expect.objectContaining({ id: "energy", value: 25, state: "Exhausted" }),
      expect.objectContaining({ id: "composure", value: 25, state: "Nervous" }),
    ]);
  });

  it("keeps authored defaults when no bar override is selected", () => {
    const character = buildPreviewCharacter(draft(), "empty", "authored");

    expect(character.stats).toEqual(expect.objectContaining({
      health: 100,
      satiety: 100,
      hydration: 100,
      energy: 100,
    }));
  });

  it("uses preview progress to acquire none, first entries, or all entries", () => {
    expect(buildPreviewCharacter(contentDraft(), "empty").holdings.items).toEqual({});
    expect(Object.keys(buildPreviewCharacter(contentDraft(), "empty").knowledge)).toEqual([]);

    const early = buildPreviewCharacter(contentDraft(), "early");
    expect(Object.keys(early.holdings.items)).toEqual(["key"]);
    expect(Object.keys(early.knowledge)).toEqual(["hydro"]);
    expect(Object.keys(early.skills)).toEqual(["repair"]);
    expect(Object.keys(early.quests)).toEqual(["restore"]);
    expect(Object.keys(early.documents)).toEqual(["manual"]);

    const populated = buildPreviewCharacter(contentDraft(), "populated");
    expect(Object.keys(populated.holdings.items)).toEqual(["key", "rope"]);
    expect(Object.keys(populated.knowledge)).toEqual(["hydro", "solar"]);
    expect(Object.keys(populated.skills)).toEqual(["repair", "navigation"]);
    expect(Object.keys(populated.quests)).toEqual(["restore", "survey"]);
    expect(Object.keys(populated.documents)).toEqual(["manual", "map"]);
  });
});
