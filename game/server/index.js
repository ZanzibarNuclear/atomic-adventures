import { createServer as createHttpServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.js";
import { StoryRepository } from "./story-repository.js";
import { buildWorldCatalog, loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { createApiHandler } from "./api.js";
import { WorldRepository } from "./world-repository.js";
import { BuildingRepository } from "./building-repository.js";
import { loadCharacterSeed } from "./character-catalog.js";
import { CharacterRepository } from "./character-repository.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 5173);
const production = process.env.NODE_ENV === "production";
const db = openDatabase();
const seedWorld = loadWorldSeed();
const buildingData = loadBuildingData();
const repository = new StoryRepository(db, buildWorldCatalog(seedWorld, buildingData));
const worldRepository = new WorldRepository(db, { seedWorld, buildingData, storyRepository: repository });
const buildingRepository = new BuildingRepository(db, {
  seedBuilding: buildingData,
  worldRepository,
  storyRepository: repository,
});
const characterRepository = new CharacterRepository(db, {
  seedCharacter: loadCharacterSeed(),
});
const authoredBuilding = buildingRepository.getDocument()?.building ?? buildingData;
worldRepository.setBuildingData(authoredBuilding);
repository.setWorld(worldRepository.getCatalog(authoredBuilding));
const api = createApiHandler(
  repository,
  worldRepository,
  buildingRepository,
  characterRepository,
);

let vite = null;
if (!production) {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
}

const server = createHttpServer(async (req, res) => {
  if (await api.handle(req, res)) return;
  if (vite) {
    vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end("Not found");
    });
    return;
  }
  serveProduction(req, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Atomic Adventures: http://127.0.0.1:${port}`);
  console.log(`Story builder:     http://127.0.0.1:${port}/builder/story`);
  console.log(`World builder:     http://127.0.0.1:${port}/builder/world`);
  console.log(`Character content: http://127.0.0.1:${port}/api/character`);
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  api.close();
  await vite?.close();
  db.close();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function serveProduction(req, res) {
  const dist = join(root, "dist");
  const requested = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  let path = join(dist, safe);
  if (!existsSync(path) || statSync(path).isDirectory()) path = join(dist, "index.html");
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };
  res.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
}
