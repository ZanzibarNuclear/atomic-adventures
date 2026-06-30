import { describe, expect, it } from "vitest";
import { validateCharacterDocument } from "./character-model.js";
import { loadContentDocuments } from "./test-content.js";

function loadCharacter() {
  return structuredClone(loadContentDocuments().character);
}

describe("character model", () => {
  it("normalizes and validates the checked-in seed", () => {
    const result = validateCharacterDocument(loadCharacter());
    expect(result.valid).toBe(true);
    expect(result.character.profile.id).toBe("zanzibar-nuhero");
    const itemIds = new Set(result.character.items.map((item) => item.id));
    expect(itemIds.size).toBe(result.character.items.length);
    expect([...itemIds]).toEqual(expect.arrayContaining([
      "field-backpack",
      "lobby-exterior-key",
    ]));
    expect(result.character.holdings.instances["field-backpack-1"]).toEqual({
      item: "field-backpack",
      holder: "character:zanzibar-nuhero",
    });
    expect(Object.values(result.character.holdings.instances)
      .every((holding) => itemIds.has(holding.item))).toBe(true);
    expect(result.character.stats.map((stat) => stat.id)).toEqual(
      expect.arrayContaining(["health", "satiety", "hydration", "energy"]),
    );
    expect(result.character.skills.some((skill) => skill.practice.awards.length > 0)).toBe(true);
    expect(result.character.documents.length).toBeGreaterThan(0);
  });

  it("rejects duplicate IDs and unresolved groups/documents", () => {
    const candidate = loadCharacter();
    candidate.items.push({
      ...candidate.items[0],
      group: "missing-group",
      relatedDocument: "missing-document",
    });
    const invalidIndex = candidate.items.length - 1;
    const result = validateCharacterDocument(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors[`items.${invalidIndex}.id`]).toBeDefined();
    expect(result.errors[`items.${invalidIndex}.group`]).toBeDefined();
    expect(result.errors[`items.${invalidIndex}.relatedDocument`]).toBeDefined();
  });
});
