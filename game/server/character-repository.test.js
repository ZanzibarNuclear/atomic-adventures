import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createContentRepositories } from "./content-repositories.js";
import { openContentDatabaseCopy } from "./test-content.js";
import { ConflictError, ValidationError } from "./story-repository.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-character-"));
  dirs.push(dir);
  const db = openContentDatabaseCopy(join(dir, "character.sqlite"));
  const { characterRepository: repository } = createContentRepositories(db);
  return { db, repository };
}

describe("CharacterRepository", () => {
  it("loads character content from the content database", () => {
    const { db, repository } = setup();
    const document = repository.getDocument();
    expect(document.character.items.some((item) => item.id === "lobby-exterior-key")).toBe(true);
    expect(repository.listRevisions().length).toBeGreaterThan(0);
    db.close();
  });

  it("saves, rejects stale/invalid edits, and restores revisions", () => {
    const { db, repository } = setup();
    const before = repository.getDocument();
    const restoreRevision = repository.listRevisions()[0].revision;
    const candidate = structuredClone(before.character);
    candidate.profile.summary = "Updated summary.";
    const saved = repository.save(candidate, before.version);
    expect(saved.version).toBe(before.version + 1);
    expect(() => repository.save(candidate, before.version)).toThrow(ConflictError);

    const invalid = structuredClone(saved.character);
    invalid.profile.id = "Bad ID";
    expect(() => repository.save(invalid, saved.version)).toThrow(ValidationError);

    const restored = repository.restore(restoreRevision);
    expect(restored.version).toBe(saved.version + 1);
    expect(restored.character.profile.summary).toBe(before.character.profile.summary);
    expect(repository.listRevisions()[0].operation).toBe("restore");
    db.close();
  });
});
