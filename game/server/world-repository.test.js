import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConflictError, ValidationError } from "./story-repository.js";
import { exportWorldYaml, parseWorldYaml } from "./world-yaml.js";
import { createContentRepositories } from "./content-repositories.js";
import { openContentDatabaseCopy } from "./test-content.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-world-"));
  dirs.push(dir);
  const db = openContentDatabaseCopy(join(dir, "world.sqlite"));
  const { storyRepository: story, worldRepository: world } = createContentRepositories(db);
  return { db, story, world };
}

describe("WorldRepository", () => {
  it("loads the outdoor world from the content database and round-trips deterministic YAML", () => {
    const { db, world } = setup();
    const document = world.getDocument();
    expect(document.world.hexes.some((hex) => hex.id === "utility-yard")).toBe(true);
    expect(parseWorldYaml(exportWorldYaml(document.world))).toEqual(document.world);
    expect(world.listRevisions().length).toBeGreaterThan(0);
    db.close();
  });

  it("saves revisions, rejects stale versions, and rolls back invalid documents", () => {
    const { db, world } = setup();
    const before = world.getDocument();
    const candidate = structuredClone(before.world);
    candidate.routes[0].label = "Revised route";
    const saved = world.save(candidate, before.version);
    expect(saved.version).toBe(before.version + 1);
    expect(saved.changedObjectIds).toContain(`route:${candidate.routes[0].id}`);
    expect(world.listRevisions()[0].operation).toBe("update");
    expect(() => world.save(candidate, before.version)).toThrow(ConflictError);

    const invalid = structuredClone(saved.world);
    invalid.hexes[1].q = invalid.hexes[0].q;
    invalid.hexes[1].r = invalid.hexes[0].r;
    expect(() => world.save(invalid, saved.version)).toThrow(ValidationError);
    expect(world.getDocument().version).toBe(saved.version);
    db.close();
  });

  it("cascades explicit hex renames into story beats in the same save", () => {
    const { db, story, world } = setup();
    story.createBeat("test", {
      id: "rename-target",
      text: "Visit the origin.",
      trigger: { place: "outdoors", hex: "origin" },
      choices: [{ text: "Continue", go_hex: "east-pines" }],
    });
    const preview = world.previewHexRename("origin", "arrival-trail");
    expect(preview.references).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "world", path: "start" }),
      expect.objectContaining({ kind: "story", beatId: "rename-target", path: "trigger.hex" }),
    ]));
    const before = world.getDocument();
    const candidate = structuredClone(before.world);
    candidate.hexes.find((hex) => hex.id === "origin").id = "arrival-trail";
    candidate.start = candidate.start === "origin" ? "arrival-trail" : candidate.start;
    candidate.journey = candidate.journey.map((id) => id === "origin" ? "arrival-trail" : id);
    for (const route of candidate.routes) {
      for (const point of route.points ?? []) if (point.hex === "origin") point.hex = "arrival-trail";
    }
    for (const feature of candidate.features) {
      if (feature.hex === "origin") feature.hex = "arrival-trail";
      for (const point of feature.points ?? []) if (point.hex === "origin") point.hex = "arrival-trail";
      if (feature.at?.hex === "origin") feature.at.hex = "arrival-trail";
    }

    const saved = world.save(candidate, before.version, [
      { kind: "hex", from: "origin", to: "arrival-trail" },
    ]);
    expect(saved.story.affected).toEqual(expect.arrayContaining([
      { areaId: "test", beatId: "rename-target" },
    ]));
    expect(story.getBeat("test", "rename-target").trigger.hex).toBe("arrival-trail");
    expect(story.listRevisions("test", "rename-target")).toHaveLength(2);
    db.close();
  });
});
