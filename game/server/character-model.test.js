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
    expect(result.character.items).toHaveLength(7);
    expect(result.character.stats.map((stat) => stat.id)).toEqual([
      "health", "hunger", "thirst",
    ]);
    expect(result.character.knowledge.map((entry) => entry.id)).toEqual([
      "hydro-head-and-flow",
    ]);
    expect(result.character.skills[0].practice.awards).toHaveLength(3);
    expect(result.character.documents.map((entry) => entry.id)).toEqual([
      "hydro-operations-primer",
    ]);
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
