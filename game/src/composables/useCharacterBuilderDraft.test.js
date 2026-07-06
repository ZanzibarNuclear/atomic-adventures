import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import {
  buildPreviewCharacter,
  duplicateCatalogEntry,
  formatSaveError,
  summarizePreviewContent,
} from "./useCharacterBuilderDraft.js";
import { characterWellbeingOverview } from "../lib/character/panel.js";
import { itemQuantity } from "../lib/character/holdings.js";

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
  it("summarizes validation errors for failed saves", () => {
    const error = new Error("Validation failed.");
    const message = formatSaveError(error, {
      "items.0.id": ["Use a unique kebab-case ID."],
      "building.doors.0.lock.key": ["Door key must reference an existing item."],
    });

    expect(message).toBe(
      "Validation failed.: items.0.id: Use a unique kebab-case ID. | building.doors.0.lock.key: Door key must reference an existing item.",
    );
  });

  it("duplicates catalog entries with a unique copy ID and copied editable fields", () => {
    const entries = reactive([
      { id: "key", label: "Key", carrying: "unique", tags: ["hydro"] },
      { id: "key-copy", label: "Key copy", carrying: "unique", tags: ["hydro"] },
    ]);

    const copy = duplicateCatalogEntry(entries[0], entries);

    expect(copy).toEqual({
      id: "key-copy-2",
      label: "Key copy",
      carrying: "unique",
      tags: ["hydro"],
    });
    expect(copy).not.toBe(entries[0]);
    expect(copy.tags).not.toBe(entries[0].tags);
  });

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
    expect(overview.health).toEqual(expect.objectContaining({ id: "health", value: 25, state: "Weak" }));
    expect(overview.vitals).toEqual([
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

  it("sets the critical preview preset to five percent", () => {
    const character = buildPreviewCharacter(draft(), "empty", "critical");

    expect(character.stats).toEqual(expect.objectContaining({
      health: 5,
      satiety: 5,
      hydration: 5,
      energy: 5,
      composure: 5,
    }));
  });

  it("uses preview progress to acquire none, first entries, or all entries", () => {
    expect(itemQuantity(buildPreviewCharacter(contentDraft(), "empty").holdings, "key")).toBe(0);
    expect(Object.keys(buildPreviewCharacter(contentDraft(), "empty").knowledge)).toEqual([]);

    const early = buildPreviewCharacter(contentDraft(), "early");
    expect(itemQuantity(early.holdings, "key")).toBe(1);
    expect(itemQuantity(early.holdings, "rope")).toBe(0);
    expect(Object.keys(early.knowledge)).toEqual(["hydro"]);
    expect(Object.keys(early.skills)).toEqual(["repair"]);
    expect(Object.keys(early.quests)).toEqual(["restore"]);
    expect(Object.keys(early.documents)).toEqual(["manual"]);

    const populated = buildPreviewCharacter(contentDraft(), "populated");
    expect(itemQuantity(populated.holdings, "key")).toBe(1);
    expect(itemQuantity(populated.holdings, "rope")).toBe(1);
    expect(Object.keys(populated.knowledge)).toEqual(["hydro", "solar"]);
    expect(Object.keys(populated.skills)).toEqual(["repair", "navigation"]);
    expect(Object.keys(populated.quests)).toEqual(["restore", "survey"]);
    expect(Object.keys(populated.documents)).toEqual(["manual", "map"]);
  });

  it("summarizes preview progress counts for the preview toolbar", () => {
    const summary = summarizePreviewContent(buildPreviewCharacter(contentDraft(), "early"));

    expect(summary).toEqual([
      { id: "inventory", label: "Inventory", acquired: 1, total: 2 },
      { id: "knowledge", label: "Knowledge", acquired: 1, total: 2 },
      { id: "skills", label: "Skills", acquired: 1, total: 2 },
      { id: "quests", label: "Quests", acquired: 1, total: 2 },
      { id: "documents", label: "Documents", acquired: 1, total: 2 },
    ]);
  });
});
