import { describe, expect, it } from "vitest";
import { loadCharacterSeed } from "./character-catalog.js";
import { validateCharacterDocument } from "./character-model.js";

describe("character model", () => {
  it("normalizes and validates the checked-in seed", () => {
    const result = validateCharacterDocument(loadCharacterSeed());
    expect(result.valid).toBe(true);
    expect(result.character.profile.id).toBe("zanzibar-nuhero");
    expect(result.character.items).toHaveLength(3);
  });

  it("rejects duplicate IDs and unresolved groups/documents", () => {
    const candidate = loadCharacterSeed();
    candidate.items.push({
      ...candidate.items[0],
      group: "missing-group",
      relatedDocument: "missing-document",
    });
    const result = validateCharacterDocument(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors["items.3.id"]).toBeDefined();
    expect(result.errors["items.3.group"]).toBeDefined();
    expect(result.errors["items.3.relatedDocument"]).toBeDefined();
  });
});
