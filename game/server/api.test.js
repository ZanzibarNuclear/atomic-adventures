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
    storylineRepository,
  } = createContentRepositories(db);
  return {
    db,
    api: createApiHandler(
      repository,
      worldRepository,
      buildingRepository,
      characterRepository,
      learningRepository,
      storylineRepository,
    ),
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
    storylineRepository,
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
  it("publishes the character catalog and protects referenced definitions", async () => {
    const { db, api, characterRepository, storylineRepository } = setup();

    const catalogRes = responseCapture();
    await api.handle(request("GET", "/api/catalog"), catalogRes);
    const catalog = JSON.parse(catalogRes.chunks.join(""));
    expect(catalog.character.items.map((item) => item.id)).toContain("lobby-exterior-key");

    const referencesRes = responseCapture();
    await api.handle(
      request("GET", "/api/character/references?domain=items&id=lobby-exterior-key"),
      referencesRes,
    );
    const references = JSON.parse(referencesRes.chunks.join(""));
    expect(references.some((reference) => reference.path.includes("lock.key"))).toBe(true);
    expect(references.some((reference) => reference.path.includes("pickups"))).toBe(true);

    const learningCharacterReferencesRes = responseCapture();
    await api.handle(
      request("GET", "/api/character/references?domain=knowledge&id=hydro-head-and-flow"),
      learningCharacterReferencesRes,
    );
    const learningCharacterReferences = JSON.parse(learningCharacterReferencesRes.chunks.join(""));
    expect(learningCharacterReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "learning",
        learningId: "learning-main",
        lessonId: "hydro-power-intro",
        path: expect.stringContaining("completion.effects"),
      }),
    ]));

    const createLessonChoiceRes = responseCapture();
    await api.handle(request("POST", "/api/story/areas/test/beats", {
      id: "lesson-choice-ref",
      text: "Lesson choice reference.",
      trigger: { place: "indoors", room: "library" },
      choices: [{
        text: "Study hydro power",
        view: { kind: "lesson", id: "hydro-power-intro", source: "library-holo-reader" },
      }],
    }), createLessonChoiceRes);
    expect(createLessonChoiceRes.status).toBe(201);

    const lessonReferencesRes = responseCapture();
    await api.handle(
      request("GET", "/api/learning/references?id=hydro-power-intro"),
      lessonReferencesRes,
    );
    const lessonReferences = JSON.parse(lessonReferencesRes.chunks.join(""));
    expect(lessonReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "story",
        areaId: "test",
        beatId: "lesson-choice-ref",
        path: "choices.0.view.id",
      }),
    ]));

    const imagesRes = responseCapture();
    await api.handle(request("GET", "/api/character/public-images?folder=items"), imagesRes);
    const images = JSON.parse(imagesRes.chunks.join(""));
    expect(imagesRes.status).toBe(200);
    expect(images.images).toContain("items/field-backpack.png");

    const storylineRes = responseCapture();
    await api.handle(request("GET", "/api/storyline"), storylineRes);
    const storyline = JSON.parse(storylineRes.chunks.join(""));
    expect(storylineRes.status).toBe(200);
    expect(storyline.storyline.id).toBe("storyline-main");
    expect(storyline.storyline.scenarios[0]).toEqual(expect.objectContaining({
      id: "part-i-opener",
      defaultMode: "story",
      startStep: "survive-in-the-woods",
    }));
    expect(storyline.storyline.scenarios[1]).toEqual(expect.objectContaining({
      id: "part-i-station",
      startStep: "find-a-way-past-fence",
    }));
    expect(storylineRepository.validate(storyline.storyline).valid).toBe(true);

    const storyArcsRes = responseCapture();
    await api.handle(request("GET", "/api/story-arcs"), storyArcsRes);
    const storyArcs = JSON.parse(storyArcsRes.chunks.join(""));
    expect(storyArcsRes.status).toBe(200);
    expect(storyArcs.story.storyArcs[0]).toEqual(expect.objectContaining({
      id: "part-i-opener",
      startBeat: "survive-in-the-woods",
    }));

    const current = characterRepository.getDocument();
    const removeRes = responseCapture();
    await api.handle(request("PUT", "/api/character", {
      character: {
        ...current.character,
        items: current.character.items.filter((item) => item.id !== "lobby-exterior-key"),
      },
      expectedVersion: current.version,
    }), removeRes);
    expect(removeRes.status).toBe(422);
    expect(
      Object.keys(JSON.parse(removeRes.chunks.join("")).errors)
        .some((path) => path.startsWith("building.") && path.endsWith(".lock.key")),
    ).toBe(true);
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
