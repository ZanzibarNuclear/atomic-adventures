import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./db.js";
import { loadCharacterSeed } from "./character-catalog.js";
import { CharacterRepository } from "./character-repository.js";
import { ConflictError, ValidationError } from "./story-repository.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-character-"));
  dirs.push(dir);
  const db = openDatabase(join(dir, "character.sqlite"));
  const repository = new CharacterRepository(db, {
    seedCharacter: loadCharacterSeed(),
  });
  return { db, repository };
}

describe("CharacterRepository", () => {
  it("seeds one revisioned character document", () => {
    const { db, repository } = setup();
    const document = repository.getDocument();
    expect(document.version).toBe(1);
    expect(document.character.items).toHaveLength(3);
    expect(repository.listRevisions()[0].operation).toBe("import");
    db.close();
  });

  it("saves, rejects stale/invalid edits, and restores revisions", () => {
    const { db, repository } = setup();
    const before = repository.getDocument();
    const candidate = structuredClone(before.character);
    candidate.profile.summary = "Updated summary.";
    const saved = repository.save(candidate, before.version);
    expect(saved.version).toBe(2);
    expect(() => repository.save(candidate, before.version)).toThrow(ConflictError);

    const invalid = structuredClone(saved.character);
    invalid.profile.id = "Bad ID";
    expect(() => repository.save(invalid, saved.version)).toThrow(ValidationError);

    const restored = repository.restore(1);
    expect(restored.version).toBe(3);
    expect(restored.character.profile.summary).toBe(before.character.profile.summary);
    expect(repository.listRevisions()[0].operation).toBe("restore");
    db.close();
  });
});
