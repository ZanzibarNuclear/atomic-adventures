import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./db.js";
import { ConflictError, StoryRepository, ValidationError } from "./story-repository.js";
import { buildWorldCatalog } from "./world-catalog.js";
import { parseStoryYaml } from "./story-yaml.js";
import { loadContentDocuments } from "./test-content.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function createRepository() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-story-"));
  dirs.push(dir);
  const path = join(dir, "test.sqlite");
  const db = openDatabase(path);
  const { world, building, character } = loadContentDocuments();
  return {
    db,
    path,
    repository: new StoryRepository(db, buildWorldCatalog(world, building), character),
  };
}

const sampleAreaYaml = `
area: part-i
name: Day 1
beats:
  intro:
    heading: Lost in the woods
    text: A narrow trail vanishes into rain-dark pines.
    trigger: { place: outdoors, hex: origin }
    choices:
      - text: Continue
        go_hex: east-pines
`;

function sampleBeat(overrides = {}) {
  return {
    id: "test-beat",
    heading: "Test",
    text: "Original text.",
    trigger: { place: "outdoors", hex: "origin" },
    choices: [{ text: "Continue", sets: ["test.done"], go_hex: "east-pines" }],
    ...overrides,
  };
}

describe("StoryRepository", () => {
  it("runs migrations repeatedly and imports the existing story", () => {
    const { db, path, repository } = createRepository();
    const source = parseStoryYaml(sampleAreaYaml);
    repository.importArea(source);
    expect(repository.getRuntimeStory().areas["part-i"].beats.intro.heading).toBe("Lost in the woods");
    db.close();
    const reopened = openDatabase(path);
    expect(reopened.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count).toBe(8);
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

  it("renames an existing beat and preserves choices and revision history", () => {
    const { db, repository } = createRepository();
    repository.createBeat("test-area", sampleBeat());
    repository.updateBeat(
      "test-area",
      "test-beat",
      sampleBeat({ text: "Updated text." }),
      1,
    );

    const renamed = repository.updateBeat(
      "test-area",
      "test-beat",
      sampleBeat({ id: "renamed-beat", text: "Renamed text." }),
      2,
    );

    expect(renamed.renamedFrom).toBe("test-beat");
    expect(repository.getBeat("test-area", "test-beat")).toBeNull();
    expect(repository.getBeat("test-area", "renamed-beat").choices[0].go_hex).toBe("east-pines");
    expect(repository.getRuntimeStory().areas["test-area"].beats["test-beat"]).toBeUndefined();
    expect(repository.getRuntimeStory().areas["test-area"].beats["renamed-beat"].text).toBe("Renamed text.");
    expect(repository.listRevisions("test-area", "test-beat")).toEqual([]);
    expect(repository.listRevisions("test-area", "renamed-beat")).toHaveLength(3);

    const restored = repository.restoreRevision("test-area", "renamed-beat", 1);
    expect(restored.beat.id).toBe("renamed-beat");
    expect(restored.beat.text).toBe("Original text.");
    db.close();
  });

  it("rejects renaming a beat to an active or historic beat ID", () => {
    const { db, repository } = createRepository();
    repository.createBeat("test-area", sampleBeat());
    repository.createBeat("test-area", sampleBeat({ id: "other-beat" }));
    expect(() => repository.updateBeat(
      "test-area",
      "test-beat",
      sampleBeat({ id: "other-beat" }),
      1,
    )).toThrow(ValidationError);

    repository.deleteBeat("test-area", "other-beat", 1);
    expect(() => repository.updateBeat(
      "test-area",
      "test-beat",
      sampleBeat({ id: "other-beat" }),
      1,
    )).toThrow(ValidationError);
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

  it("strips legacy story requirement and choice character fields", () => {
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
    expect(beat.require).toBeUndefined();
    expect(beat.choices[0].require).toBeUndefined();
    expect(beat.choices[0].effects).toBeUndefined();
    db.close();
  });

  it("round-trips story choice stage view actions", () => {
    const { db, repository } = createRepository();
    repository.createBeat("test-area", sampleBeat({
      choices: [{
        text: "Check your inventory",
        view: { kind: "inventory" },
      }],
    }));

    const beat = repository.getBeat("test-area", "test-beat");
    expect(beat.choices[0].view).toEqual({ kind: "inventory" });
    expect(repository.getRuntimeStory().areas["test-area"].beats["test-beat"].choices[0].view)
      .toEqual({ kind: "inventory" });
    db.close();
  });

  it("round-trips exterior-node movement choices", () => {
    const { db, repository } = createRepository();
    repository.createBeat("test-area", sampleBeat({
      choices: [{
        text: "Walk around the building",
        go_exterior_node: "north-east-corner",
      }],
    }));

    const beat = repository.getBeat("test-area", "test-beat");
    expect(beat.choices[0].go_exterior_node).toBe("north-east-corner");
    expect(repository.getRuntimeStory().areas["test-area"].beats["test-beat"].choices[0].go_exterior_node)
      .toBe("north-east-corner");
    db.close();
  });

  it("round-trips origin-hex beat matching", () => {
    const { db, repository } = createRepository();
    repository.createBeat("test-area", sampleBeat({
      match: { originHex: "the-flats", localExit: "garage-exit" },
    }));

    const beat = repository.getBeat("test-area", "test-beat");
    expect(beat.match).toEqual({ originHex: "the-flats", localExit: "garage-exit" });
    expect(repository.getRuntimeStory().areas["test-area"].beats["test-beat"].match)
      .toEqual({ originHex: "the-flats", localExit: "garage-exit" });
    db.close();
  });

  it("rejects origin-hex matching on non-hex beats", () => {
    const { db, repository } = createRepository();
    expect(() => repository.createBeat("test-area", sampleBeat({
      trigger: { place: "indoors", room: "small-bay" },
      match: { originHex: "the-flats" },
    }))).toThrow(ValidationError);
    db.close();
  });
});
