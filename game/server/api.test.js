import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiHandler } from "./api.js";
import { createContentRepositories } from "./content-repositories.js";
import { openContentDatabaseCopy } from "./test-content.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-api-"));
  dirs.push(dir);
  const db = openContentDatabaseCopy(join(dir, "api.sqlite"));
  const {
    storyRepository: repository,
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
    storyArcRepository,
  } = createContentRepositories(db);
  return {
    db,
    api: createApiHandler(
      repository,
      worldRepository,
      buildingRepository,
      characterRepository,
      learningRepository,
      storyArcRepository,
    ),
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
    repository,
    storyArcRepository,
  };
}

function responseCapture() {
  return {
    status: null,
    headers: null,
    chunks: [],
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    write(chunk) {
      this.chunks.push(String(chunk));
    },
    end(chunk = "") {
      if (chunk) this.chunks.push(String(chunk));
    },
  };
}

function request(method, url, body) {
  const req = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = url;
  return req;
}

describe("story API", () => {
  it("preserves an authored arc completion card through the save API", async () => {
    const { db, api, storyArcRepository } = setup();
    const current = storyArcRepository.getDocument();
    const storyArcDocument = structuredClone(current.storyArcDocument);
    const [sourceArc, destinationArc] = storyArcDocument.storyArcs;
    sourceArc.completion = {
      nextArc: destinationArc.id,
      card: {
        eyebrow: "Day 1 complete",
        heading: "Shelter at last",
        description: "A quiet night in the library.",
        note: "More tomorrow.",
        actionLabel: "Continue",
      },
    };

    const response = responseCapture();
    await api.handle(request("PUT", "/api/story-arcs/document", {
      storyArcDocument,
      expectedVersion: current.version,
    }), response);

    expect(response.status).toBe(200);
    const saved = JSON.parse(response.chunks.join(""));
    expect(saved.storyArcDocument.storyArcs[0].completion).toEqual(sourceArc.completion);
    expect(storyArcRepository.getDocument().storyArcDocument.storyArcs[0].completion).toEqual(sourceArc.completion);
    db.close();
  });

  it("splits scene membership and the story arc document atomically", async () => {
    const { db, api, storyArcRepository, repository } = setup();
    const current = storyArcRepository.getDocument();
    const storyArcDocument = structuredClone(current.storyArcDocument);
    const sourceLink = db.prepare(`
      SELECT area_id AS areaId, story_beat AS storyBeat
      FROM story_beats
      WHERE story_beat IS NOT NULL
      GROUP BY area_id, story_beat
      HAVING COUNT(*) >= 2
      ORDER BY story_beat
      LIMIT 1
    `).get();
    const arc = storyArcDocument.storyArcs.find((item) => item.beats.some((beat) => beat.id === sourceLink.storyBeat));
    const sourceIndex = arc.beats.findIndex((beat) => beat.id === sourceLink.storyBeat);
    const source = arc.beats[sourceIndex];
    const linkedScenes = repository.listBeats(sourceLink.areaId, { full: true }).filter((scene) => scene.storyBeat === source.id);
    const movedScene = linkedScenes.at(-1);
    const retainedScene = linkedScenes.find((scene) => scene.id !== movedScene.id);
    const oldNext = source.next;
    const newBeat = {
      id: `${source.id}-split-test`,
      title: `${source.title} split test`,
      scene: movedScene.id,
      choices: [],
      allowed: {
        movement: { mode: null, hexes: [], rooms: [], exteriorNodes: [], transitions: [] },
        storyForwardActions: [], optionalActions: [], storyChoices: [], stageViews: [],
        indoorActions: [], outdoorActions: [], itemActions: [], developerActions: [],
      },
      completesWhen: null, onEnter: null, onComplete: null,
      next: oldNext,
    };
    source.scene = retainedScene.id;
    source.next = newBeat.id;
    arc.beats.splice(sourceIndex + 1, 0, newBeat);
    const sceneBefore = db.prepare("SELECT story_beat, version FROM story_beats WHERE area_id = ? AND id = ?").get(sourceLink.areaId, movedScene.id);

    const response = responseCapture();
    await api.handle(request("POST", "/api/story-arcs/document/split-beat", {
      areaId: sourceLink.areaId,
      beatId: source.id,
      newBeatId: newBeat.id,
      storyArcDocument,
      sceneIds: [movedScene.id],
      sceneVersions: { [movedScene.id]: sceneBefore.version },
      expectedVersion: current.version,
    }), response);

    expect(response.status).toBe(200);
    const saved = JSON.parse(response.chunks.join(""));
    expect(saved.storyArcDocument.storyArcs.find((item) => item.id === arc.id).beats.map((beat) => beat.id)).toContain(newBeat.id);
    expect(db.prepare("SELECT story_beat FROM story_beats WHERE area_id = ? AND id = ?").get(sourceLink.areaId, movedScene.id).story_beat).toBe(newBeat.id);

    const staleResponse = responseCapture();
    await api.handle(request("POST", "/api/story-arcs/document/split-beat", {
      areaId: sourceLink.areaId, beatId: source.id, newBeatId: "another-beat",
      storyArcDocument, sceneIds: [retainedScene.id], sceneVersions: { [retainedScene.id]: 0 }, expectedVersion: current.version,
    }), staleResponse);
    expect(staleResponse.status).toBe(409);
    expect(db.prepare("SELECT story_beat FROM story_beats WHERE area_id = ? AND id = ?").get(sourceLink.areaId, retainedScene.id).story_beat).toBe(source.id);
    db.close();
  });

  it("cascades character item ID renames through authored building references", async () => {
    const { db, api, characterRepository, buildingRepository } = setup();
    const current = characterRepository.getDocument();
    const character = structuredClone(current.character);
    const item = character.items.find((entry) => entry.id === "lobby-exterior-key");
    item.id = "lobby-side-door-key";

    const renameRes = responseCapture();
    await api.handle(request("PUT", "/api/character", {
      character,
      expectedVersion: current.version,
      renames: [{
        domain: "items",
        from: "lobby-exterior-key",
        to: "lobby-side-door-key",
      }],
    }), renameRes);

    expect(renameRes.status).toBe(200);
    const building = buildingRepository.getDocument().building;
    expect(building.doors.some((door) => door.lock?.key === "lobby-side-door-key")).toBe(true);
    expect(building.pickups.some((pickup) => pickup.item === "lobby-side-door-key")).toBe(true);
    db.close();
  });

  it("cascades item renames through building action effects", async () => {
    const { db, api, characterRepository, buildingRepository } = setup();
    const buildingDocument = buildingRepository.getDocument();
    const building = structuredClone(buildingDocument.building);
    building.actions.push({
      id: "grant-test-key",
      room: "library",
      label: "Grant test key",
      effects: [{ op: "item.add", id: "lobby-exterior-key", quantity: 1 }],
    });
    buildingRepository.save(building.id, building, buildingDocument.version);

    const current = characterRepository.getDocument();
    const character = structuredClone(current.character);
    const item = character.items.find((entry) => entry.id === "lobby-exterior-key");
    item.id = "lobby-side-door-key";

    const renameRes = responseCapture();
    await api.handle(request("PUT", "/api/character", {
      character,
      expectedVersion: current.version,
      renames: [{
        domain: "items",
        from: "lobby-exterior-key",
        to: "lobby-side-door-key",
      }],
    }), renameRes);

    expect(renameRes.status).toBe(200);
    const action = buildingRepository.getDocument().building.actions
      .find((candidate) => candidate.id === "grant-test-key");
    expect(action.effects[0]).toEqual(expect.objectContaining({
      op: "item.add",
      id: "lobby-side-door-key",
    }));
    db.close();
  });

  it("infers and cascades an item rename when the client saves the renamed draft", async () => {
    const { db, api, characterRepository, buildingRepository } = setup();
    const buildingDocument = buildingRepository.getDocument();
    const building = structuredClone(buildingDocument.building);
    building.actions.push({
      id: "grant-test-key",
      room: "library",
      label: "Grant test key",
      effects: [{ op: "item.add", id: "lobby-exterior-key", quantity: 1 }],
    });
    buildingRepository.save(building.id, building, buildingDocument.version);

    const current = characterRepository.getDocument();
    const character = structuredClone(current.character);
    const item = character.items.find((entry) => entry.id === "lobby-exterior-key");
    item.id = "lobby-side-door-key";

    const renameRes = responseCapture();
    await api.handle(request("PUT", "/api/character", {
      character,
      expectedVersion: current.version,
    }), renameRes);

    expect(renameRes.status).toBe(200);
    const action = buildingRepository.getDocument().building.actions
      .find((candidate) => candidate.id === "grant-test-key");
    expect(action.effects[0].id).toBe("lobby-side-door-key");
    db.close();
  });

  it("cascades character ID renames for every content catalog", async () => {
    const { db, api, characterRepository, buildingRepository } = setup();
    const buildingDocument = buildingRepository.getDocument();
    const building = structuredClone(buildingDocument.building);
    building.actions.push({
      id: "all-catalog-refs",
      room: "library",
      label: "All catalog references",
      require: {
        items: { all: ["lobby-exterior-key"] },
        stats: [{ id: "health", op: "gte", value: 1 }],
        knowledge: { all: ["hydro-head-and-flow"] },
        skills: [{ id: "hydro-operations", op: "gte", value: 1 }],
        quests: [{ id: "restore-hydro", op: "started" }],
        documents: { all: ["hydro-operations-primer"] },
      },
      effects: [
        { op: "item.add", id: "lobby-exterior-key", quantity: 1 },
        { op: "stat.add", id: "health", value: 1 },
        { op: "knowledge.acquire", id: "hydro-head-and-flow" },
        { op: "skill.add-evidence", id: "hydro-operations", evidence: "operating-days", value: 1 },
        { op: "quest.start", id: "restore-hydro" },
        { op: "document.discover", id: "hydro-operations-primer" },
      ],
    });
    buildingRepository.save(building.id, building, buildingDocument.version);

    const current = characterRepository.getDocument();
    const character = structuredClone(current.character);
    const renames = [
      ["items", "lobby-exterior-key", "lobby-side-door-key"],
      ["stats", "health", "body-condition"],
      ["knowledge", "hydro-head-and-flow", "hydro-water-power"],
      ["skills", "hydro-operations", "hydro-plant-ops"],
      ["quests", "restore-hydro", "restart-hydro"],
      ["documents", "hydro-operations-primer", "hydro-ops-primer"],
    ].map(([domain, from, to]) => ({ domain, from, to }));
    for (const { domain, from, to } of renames) {
      const entry = character[domain].find((candidate) => candidate.id === from);
      entry.id = to;
    }
    character.items.find((item) => item.id === "lobby-side-door-key").relatedDocument = "hydro-operations-primer";

    const renameRes = responseCapture();
    await api.handle(request("PUT", "/api/character", {
      character,
      expectedVersion: current.version,
      renames,
    }), renameRes);

    expect(renameRes.status).toBe(200);
    const savedCharacter = JSON.parse(renameRes.chunks.join("")).character;
    expect(savedCharacter.items.some((entry) => entry.id === "lobby-side-door-key")).toBe(true);
    expect(savedCharacter.stats.some((entry) => entry.id === "body-condition")).toBe(true);
    expect(savedCharacter.knowledge.some((entry) => entry.id === "hydro-water-power")).toBe(true);
    expect(savedCharacter.skills.some((entry) => entry.id === "hydro-plant-ops")).toBe(true);
    expect(savedCharacter.quests.some((entry) => entry.id === "restart-hydro")).toBe(true);
    expect(savedCharacter.documents.some((entry) => entry.id === "hydro-ops-primer")).toBe(true);
    expect(savedCharacter.items.find((item) => item.id === "lobby-side-door-key").relatedDocument)
      .toBe("hydro-ops-primer");

    const action = buildingRepository.getDocument().building.actions
      .find((candidate) => candidate.id === "all-catalog-refs");
    expect(action.require).toMatchObject({
      items: { all: ["lobby-side-door-key"] },
      stats: [expect.objectContaining({ id: "body-condition" })],
      knowledge: { all: ["hydro-water-power"] },
      skills: [expect.objectContaining({ id: "hydro-plant-ops" })],
      quests: [expect.objectContaining({ id: "restart-hydro" })],
      documents: { all: ["hydro-ops-primer"] },
    });
    expect(action.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: "item.add", id: "lobby-side-door-key" }),
      expect.objectContaining({ op: "stat.add", id: "body-condition" }),
      expect.objectContaining({ op: "knowledge.acquire", id: "hydro-water-power" }),
      expect.objectContaining({ op: "skill.add-evidence", id: "hydro-plant-ops" }),
      expect.objectContaining({ op: "quest.start", id: "restart-hydro" }),
      expect.objectContaining({ op: "document.discover", id: "hydro-ops-primer" }),
    ]));
    db.close();
  });

  it("serves, validates, and restores revisioned character content", async () => {
    const { db, api, characterRepository } = setup();

    const getRes = responseCapture();
    await api.handle(request("GET", "/api/character"), getRes);
    expect(getRes.status).toBe(200);
    expect(JSON.parse(getRes.chunks.join("")).character.items).toEqual(
      expect.any(Array),
    );

    const invalidRes = responseCapture();
    await api.handle(
      request("POST", "/api/character/validate", {
        character: {
          ...characterRepository.getDocument().character,
          profile: { id: "Bad ID", name: "" },
        },
      }),
      invalidRes,
    );
    expect(invalidRes.status).toBe(422);

    const current = characterRepository.getDocument();
    const restoreRevision = characterRepository.listRevisions()[0].revision;
    characterRepository.save({
      ...current.character,
      profile: { ...current.character.profile, summary: "Temporary revision." },
    }, current.version);
    const restoreRes = responseCapture();
    await api.handle(request("POST", `/api/character/revisions/${restoreRevision}/restore`), restoreRes);
    expect(restoreRes.status).toBe(200);
    expect(JSON.parse(restoreRes.chunks.join("")).character.profile.summary)
      .toBe(current.character.profile.summary);

    api.close();
    db.close();
  });

  it("broadcasts committed mutations and not rejected saves", async () => {
    const {
      db,
      api,
      worldRepository,
      buildingRepository,
      characterRepository,
    } = setup();
    const eventReq = new EventEmitter();
    eventReq.method = "GET";
    eventReq.url = "/api/content/events";
    const eventRes = responseCapture();
    await api.handle(eventReq, eventRes);
    expect(eventRes.chunks.join("")).toContain("characterRevision");

    const valid = {
      id: "api-beat",
      text: "API story",
      trigger: { place: "outdoors", hex: "origin" },
      choices: [],
    };
    const createRes = responseCapture();
    await api.handle(request("POST", "/api/story/areas/test/beats", valid), createRes);
    expect(createRes.status).toBe(201);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("story.updated"))).toHaveLength(1);

    const milestonesRes = responseCapture();
    await api.handle(
      request("PUT", "/api/story/areas/test/milestones", {
        milestones: [{ id: "hydro.online", label: "Hydro online", kind: "operations" }],
      }),
      milestonesRes,
    );
    expect(milestonesRes.status).toBe(200);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("story.updated"))).toHaveLength(2);

    const invalidRes = responseCapture();
    await api.handle(
      request("POST", "/api/story/areas/test/beats", { ...valid, id: "Bad ID" }),
      invalidRes,
    );
    expect(invalidRes.status).toBe(422);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("story.updated"))).toHaveLength(2);

    const currentWorld = worldRepository.getDocument();
    const worldRes = responseCapture();
    await api.handle(
      request("PUT", "/api/world/outdoors", {
        world: {
          ...currentWorld.world,
          routes: currentWorld.world.routes.map((route, index) =>
            index === 0 ? { ...route, label: "API-updated route" } : route,
          ),
        },
        expectedVersion: currentWorld.version,
      }),
      worldRes,
    );
    expect(worldRes.status).toBe(200);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("world.updated"))).toHaveLength(1);

    const currentBuilding = buildingRepository.getDocument();
    const buildingRes = responseCapture();
    await api.handle(
      request("PUT", "/api/world/buildings/utility-station", {
        building: {
          ...currentBuilding.building,
          rooms: currentBuilding.building.rooms.map((room) =>
            room.id === "library" ? movedRoom(room, -0.5, 0) : room,
          ),
        },
        expectedVersion: currentBuilding.version,
      }),
      buildingRes,
    );
    expect(buildingRes.status).toBe(200);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("building.updated"))).toHaveLength(1);

    const currentCharacter = characterRepository.getDocument();
    const characterRes = responseCapture();
    await api.handle(
      request("PUT", "/api/character", {
        character: {
          ...currentCharacter.character,
          profile: {
            ...currentCharacter.character.profile,
            summary: "Updated through the API.",
          },
        },
        expectedVersion: currentCharacter.version,
      }),
      characterRes,
    );
    expect(characterRes.status).toBe(200);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("character.updated")))
      .toHaveLength(1);

    api.close();
    db.close();
  });
});

function movedRoom(room, dx, dy) {
  return {
    ...room,
    x: room.x + dx,
    y: room.y + dy,
    stands: (room.stands ?? []).map((stand) => ({
      ...stand,
      at: {
        x: stand.at.x + dx,
        y: stand.at.y + dy,
      },
    })),
  };
}
