import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiHandler } from "./api.js";
import { openDatabase } from "./db.js";
import { StoryRepository } from "./story-repository.js";
import { loadWorldCatalog } from "./world-catalog.js";

const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "atomic-api-"));
  dirs.push(dir);
  const db = openDatabase(join(dir, "api.sqlite"));
  const world = loadWorldCatalog();
  const repository = new StoryRepository(db, world);
  return { db, api: createApiHandler(repository, world) };
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
    const { db, api } = setup();
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

    api.close();
    db.close();
  });
});
