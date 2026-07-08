import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConflictError, ValidationError } from "./story-repository.js";
import { createContentRepositories } from "./content-repositories.js";
import { openContentDatabaseCopy } from "./test-content.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-building-"));
  dirs.push(dir);
  const db = openContentDatabaseCopy(join(dir, "building.sqlite"));
  const {
    storyRepository: story,
    worldRepository: world,
    buildingRepository: building,
  } = createContentRepositories(db);
  return { db, story, world, building };
}

describe("BuildingRepository", () => {
  it("loads the utility station from the content database", () => {
    const { db, building } = setup();
    const document = building.getDocument();
    expect(document.building.rooms.some((room) => room.id === "large-bay")).toBe(true);
    expect(document.building.rooms.find((room) => room.id === "conference")?.views).toEqual([
      expect.objectContaining({
        id: "doorway",
        kind: "image",
        src: "views/conference-room-cool-doorway.png",
      }),
    ]);
    expect(building.listRevisions().length).toBeGreaterThan(0);
    db.close();
  });

  it("saves geometry revisions and rejects stale or invalid edits", () => {
    const { db, building } = setup();
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    moveRoom(candidate, "library", -0.5, 0);
    const saved = building.save("utility-station", candidate, before.version);
    expect(saved.version).toBe(before.version + 1);
    expect(saved.changedObjectIds).toContain("room:library");
    expect(() => building.save("utility-station", candidate, before.version))
      .toThrow(ConflictError);

    const invalid = structuredClone(saved.building);
    invalid.exterior.entry = "missing-node";
    expect(() => building.save("utility-station", invalid, saved.version))
      .toThrow(ValidationError);
    expect(building.getDocument().version).toBe(saved.version);
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
    expect(saved.story.affected).toEqual(expect.arrayContaining([
      { areaId: "test", beatId: "library-rename" },
    ]));
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

  it("validates room and stand location image views", () => {
    const { db, building } = setup();
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    const room = candidate.rooms.find((item) => item.id === "large-bay");
    room.views = [{
      id: "tools",
      kind: "image",
      src: "views/garage-large-bay.png",
      label: "Large bay",
      alt: "The large bay garage.",
    }];
    room.stands = [
      ...(room.stands ?? []),
      {
        id: "tool-rack",
        label: "Tool rack",
        at: { x: room.x + 0.5, y: room.y + 0.5 },
        views: [{
          id: "rack",
          kind: "image",
          src: "views/garage-small-bay-buggy.png",
          label: "Rack view",
          alt: "Tools near the garage bay.",
        }],
      },
    ];
    const saved = building.save("utility-station", candidate, before.version);
    expect(saved.building.rooms.find((item) => item.id === "large-bay").views[0].src)
      .toBe("views/garage-large-bay.png");
    expect(saved.building.rooms.find((item) => item.id === "large-bay").stands.at(-1).views[0].src)
      .toBe("views/garage-small-bay-buggy.png");

    const invalid = structuredClone(saved.building);
    invalid.rooms.find((item) => item.id === "large-bay").views = [
      { id: "bad path", kind: "image", src: "items/field-backpack.png" },
    ];
    expect(() => building.save("utility-station", invalid, saved.version))
      .toThrow(ValidationError);
    db.close();
  });

  it("validates pickup stands against the pickup room", () => {
    const { db, building } = setup();
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    const room = candidate.rooms.find((item) => item.id === "large-bay");
    room.stands = [
      ...(room.stands ?? []),
      { id: "tool-rack", label: "Tool rack", at: { x: room.x + 0.5, y: room.y + 0.5 } },
    ];
    candidate.pickups ??= [];
    candidate.pickups.push({
      id: "large-bay-cutter-case",
      room: "large-bay",
      stand: "tool-rack",
      item: "lobby-exterior-key",
      label: "Cutter case",
    });
    candidate.pickups.push({
      id: "large-bay-door-hook",
      room: "large-bay",
      stand: "door:large-bay-man",
      item: "large-bay-man-key",
      label: "Garage door hook",
    });
    const saved = building.save("utility-station", candidate, before.version);
    expect(saved.building.pickups.at(-2).stand).toBe("tool-rack");
    expect(saved.building.pickups.at(-1).stand).toBe("door:large-bay-man");

    const invalid = structuredClone(saved.building);
    invalid.pickups.at(-1).stand = "missing-stand";
    expect(() => building.save("utility-station", invalid, saved.version))
      .toThrow(ValidationError);

    const wrongSide = structuredClone(saved.building);
    wrongSide.pickups.at(-1).stand = "door:hallway-small-bay";
    expect(() => building.save("utility-station", wrongSide, saved.version))
      .toThrow(ValidationError);
    db.close();
  });

  it("validates action stands against the action room", () => {
    const { db, building } = setup();
    const before = building.getDocument();
    const candidate = structuredClone(before.building);
    const room = candidate.rooms.find((item) => item.id === "large-bay");
    room.stands = [
      ...(room.stands ?? []),
      { id: "tool-rack", label: "Tool rack", at: { x: room.x + 0.5, y: room.y + 0.5 } },
    ];
    candidate.actions ??= [];
    candidate.actions.push({
      id: "inspect-tool-rack",
      room: "large-bay",
      stand: "tool-rack",
      label: "Inspect the tool rack",
    });
    candidate.actions.push({
      id: "inspect-garage-door-hook",
      room: "large-bay",
      stand: "door:large-bay-man",
      label: "Inspect the garage door hook",
    });
    const saved = building.save("utility-station", candidate, before.version);
    expect(saved.building.actions.at(-2).stand).toBe("tool-rack");
    expect(saved.building.actions.at(-1).stand).toBe("door:large-bay-man");

    const invalid = structuredClone(saved.building);
    invalid.actions.at(-1).stand = "missing-stand";
    expect(() => building.save("utility-station", invalid, saved.version))
      .toThrow(ValidationError);

    const wrongSide = structuredClone(saved.building);
    wrongSide.actions.at(-1).stand = "door:hallway-small-bay";
    expect(() => building.save("utility-station", wrongSide, saved.version))
      .toThrow(ValidationError);
    db.close();
  });
});

function moveRoom(building, roomId, dx, dy) {
  const room = building.rooms.find((item) => item.id === roomId);
  room.x += dx;
  room.y += dy;
  for (const stand of room.stands ?? []) {
    stand.at.x += dx;
    stand.at.y += dy;
  }
}
