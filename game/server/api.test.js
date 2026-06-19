import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiHandler } from "./api.js";
import { openDatabase } from "./db.js";
import { StoryRepository } from "./story-repository.js";
import { buildWorldCatalog, loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository } from "./world-repository.js";
import { BuildingRepository } from "./building-repository.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-api-"));
  dirs.push(dir);
  const db = openDatabase(join(dir, "api.sqlite"));
  const seedWorld = loadWorldSeed();
  const buildingData = loadBuildingData();
  const repository = new StoryRepository(db, buildWorldCatalog(seedWorld, buildingData));
  const worldRepository = new WorldRepository(db, { seedWorld, buildingData, storyRepository: repository });
  const buildingRepository = new BuildingRepository(db, {
    seedBuilding: buildingData,
    worldRepository,
    storyRepository: repository,
  });
  return {
    db,
    api: createApiHandler(repository, worldRepository, buildingRepository),
    worldRepository,
    buildingRepository,
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
  it("broadcasts committed mutations and not rejected saves", async () => {
    const { db, api, worldRepository, buildingRepository } = setup();
    const eventReq = new EventEmitter();
    eventReq.method = "GET";
    eventReq.url = "/api/content/events";
    const eventRes = responseCapture();
    await api.handle(eventReq, eventRes);

    const valid = {
      id: "api-beat",
      text: "API story",
      trigger: { place: "outdoors", hex: "trailhead" },
      choices: [],
    };
    const createRes = responseCapture();
    await api.handle(request("POST", "/api/story/areas/test/beats", valid), createRes);
    expect(createRes.status).toBe(201);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("story.updated"))).toHaveLength(1);

    const invalidRes = responseCapture();
    await api.handle(
      request("POST", "/api/story/areas/test/beats", { ...valid, id: "Bad ID" }),
      invalidRes,
    );
    expect(invalidRes.status).toBe(422);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("story.updated"))).toHaveLength(1);

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
            room.id === "library" ? { ...room, x: room.x - 0.5 } : room,
          ),
        },
        expectedVersion: currentBuilding.version,
      }),
      buildingRes,
    );
    expect(buildingRes.status).toBe(200);
    expect(eventRes.chunks.filter((chunk) => chunk.includes("building.updated"))).toHaveLength(1);

    api.close();
    db.close();
  });
});
