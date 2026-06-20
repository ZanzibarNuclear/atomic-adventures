import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./db.js";
import { StoryRepository, ConflictError, ValidationError } from "./story-repository.js";
import { buildWorldCatalog, loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository } from "./world-repository.js";
import { BuildingRepository } from "./building-repository.js";
import { CharacterRepository } from "./character-repository.js";
import { loadCharacterSeed } from "./character-catalog.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-building-"));
  dirs.push(dir);
  const db = openDatabase(join(dir, "building.sqlite"));
  const seedWorld = loadWorldSeed();
  const seedBuilding = loadBuildingData();
  const character = new CharacterRepository(db, {
    seedCharacter: loadCharacterSeed(),
  });
  const story = new StoryRepository(
    db,
    buildWorldCatalog(seedWorld, seedBuilding),
    character.getDocument().character,
  );
  const world = new WorldRepository(db, {
    seedWorld,
    buildingData: seedBuilding,
    storyRepository: story,
  });
  const building = new BuildingRepository(db, {
    seedBuilding,
    worldRepository: world,
    storyRepository: story,
    characterRepository: character,
  });
  return { db, story, world, building };
}

describe("BuildingRepository", () => {
  it("seeds the utility station as one revisioned document", () => {
    const { db, building } = setup();
    const document = building.getDocument();
    expect(document.version).toBe(1);
    expect(document.building.rooms.some((room) => room.id === "large-bay")).toBe(true);
    expect(building.listRevisions()[0].operation).toBe("import");
    db.close();
  });

  it("saves geometry revisions and rejects stale or invalid edits", () => {
    const { db, building } = setup();
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    candidate.rooms.find((room) => room.id === "library").x -= 0.5;
    const saved = building.save("utility-station", candidate, before.version);
    expect(saved.version).toBe(2);
    expect(saved.changedObjectIds).toContain("room:library");
    expect(() => building.save("utility-station", candidate, before.version))
      .toThrow(ConflictError);

    const invalid = structuredClone(saved.building);
    invalid.exterior.entry = "missing-node";
    expect(() => building.save("utility-station", invalid, saved.version))
      .toThrow(ValidationError);
    expect(building.getDocument().version).toBe(2);
    db.close();
  });

  it("rejects deleting rooms referenced by story beats", () => {
    const { db, story, building } = setup();
    story.createBeat("test", {
      id: "library-beat",
      text: "Library.",
      trigger: { place: "indoors", room: "library" },
      choices: [],
    });
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    candidate.rooms = candidate.rooms.filter((room) => room.id !== "library");
    candidate.links = candidate.links.filter(
      (link) => link.from !== "library" && link.to !== "library",
    );
    candidate.doors = candidate.doors.filter(
      (door) => !["library-hallway", "library-corridor"].includes(door.id),
    );
    expect(() => building.save("utility-station", candidate, before.version))
      .toThrow(ValidationError);
    db.close();
  });

  it("cascades explicit room renames into story beats", () => {
    const { db, story, building } = setup();
    story.createBeat("test", {
      id: "library-rename",
      text: "Library.",
      trigger: { place: "indoors", room: "library" },
      choices: [{ text: "Return", go_room: "library" }],
    });
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    candidate.rooms.find((room) => room.id === "library").id = "archive";
    candidate.start = candidate.start === "library" ? "archive" : candidate.start;
    for (const link of candidate.links) {
      if (link.from === "library") link.from = "archive";
      if (link.to === "library") link.to = "archive";
    }
    for (const door of candidate.doors) {
      if (door.lock?.freeFrom === "library") door.lock.freeFrom = "archive";
    }
    const saved = building.save("utility-station", candidate, before.version, [
      { kind: "room", from: "library", to: "archive" },
    ]);
    expect(saved.story.affected).toEqual([{ areaId: "test", beatId: "library-rename" }]);
    expect(story.getBeat("test", "library-rename").trigger.room).toBe("archive");
    expect(story.getBeat("test", "library-rename").choices[0].go_room).toBe("archive");
    db.close();
  });

  it("rejects invalid room stands and default stand references", () => {
    const { db, building } = setup();
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    const room = candidate.rooms.find((item) => item.id === "large-bay");
    room.stands = [{ id: "outside", at: { x: 99, y: 99 } }];
    room.defaultStand = "missing";
    expect(() => building.save("utility-station", candidate, before.version))
      .toThrow(ValidationError);
    db.close();
  });
});
