import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./db.js";
import { ConflictError, StoryRepository, ValidationError } from "./story-repository.js";
import { loadWorldCatalog } from "./world-catalog.js";
import { parseStoryYaml } from "./story-yaml.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createRepository() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-story-"));
  dirs.push(dir);
  const path = join(dir, "test.sqlite");
  const db = openDatabase(path);
  return { db, path, repository: new StoryRepository(db, loadWorldCatalog()) };
}

function sampleBeat(overrides = {}) {
  return {
    id: "test-beat",
    order: 0,
    once: true,
    acknowledge: true,
    heading: "Test",
    text: "Original text.",
    trigger: { place: "outdoors", hex: "trailhead" },
    require: { all: [], any: [], not: [] },
    choices: [{ text: "Continue", sets: ["test.done"], go_hex: "east-pines" }],
    ...overrides,
  };
}

describe("StoryRepository", () => {
  it("runs migrations repeatedly and imports the existing story", () => {
    const { db, path, repository } = createRepository();
    const source = parseStoryYaml(
      readFileSync(new URL("../content/story/part-i.yaml", import.meta.url), "utf8"),
    );
    repository.importArea(source);
    expect(repository.getRuntimeStory().areas["part-i"].beats.intro.heading).toBe("Lost in the woods");
    db.close();
    const reopened = openDatabase(path);
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count).toBe(5);
    reopened.close();
  });

  it("creates, updates, conflicts, restores, and deletes transactionally", () => {
    const { db, repository } = createRepository();
    const created = repository.createBeat("test-area", sampleBeat());
    expect(created.beat.version).toBe(1);
    expect(repository.listRevisions("test-area", "test-beat")).toHaveLength(1);

    const updated = repository.updateBeat(
      "test-area",
      "test-beat",
      sampleBeat({ text: "Updated text." }),
      1,
    );
    expect(updated.beat.version).toBe(2);
    expect(updated.beat.text).toBe("Updated text.");
    expect(() => repository.updateBeat("test-area", "test-beat", sampleBeat(), 1)).toThrow(ConflictError);

    const restored = repository.restoreRevision("test-area", "test-beat", 1);
    expect(restored.beat.text).toBe("Original text.");
    expect(restored.beat.version).toBe(3);

    repository.deleteBeat("test-area", "test-beat", 3);
    expect(repository.getBeat("test-area", "test-beat")).toBeNull();
    expect(repository.listRevisions("test-area", "test-beat").at(0).operation).toBe("delete");
    db.close();
  });

  it("rejects invalid content without incrementing the global revision", () => {
    const { db, repository } = createRepository();
    const before = repository.getGlobalRevision();
    expect(() => repository.createBeat("test-area", sampleBeat({ id: "Bad ID", text: "" })))
      .toThrow(ValidationError);
    expect(repository.getGlobalRevision()).toBe(before);
    expect(repository.listBeats("test-area")).toEqual([]);
    db.close();
  });

  it("writes committed content directly to the tracked database file", () => {
    const { db, path, repository } = createRepository();
    const before = statSync(path).mtimeMs;

    repository.createBeat("test-area", sampleBeat());

    expect(db.prepare("PRAGMA journal_mode").get().journal_mode).toBe("delete");
    expect(existsSync(`${path}-wal`)).toBe(false);
    expect(statSync(path).mtimeMs).toBeGreaterThanOrEqual(before);
    db.close();
  });

  it("persists generic character requirements and ordered effects", () => {
    const { db, repository } = createRepository();
    repository.createBeat("test-area", sampleBeat({
      require: { items: ["lobby-exterior-key"] },
      choices: [{
        text: "Continue",
        require: { knowledge: ["hydro-basics"] },
        effects: [
          { op: "item.add", id: "hallway-small-bay-key" },
          { op: "flag.set", id: "test.done" },
        ],
      }],
    }));

    const beat = repository.getBeat("test-area", "test-beat");
    expect(beat.require.items).toEqual(["lobby-exterior-key"]);
    expect(beat.choices[0].effects.map((effect) => effect.op)).toEqual([
      "item.add",
      "flag.set",
    ]);
    db.close();
  });
});
