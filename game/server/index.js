import { createServer as createHttpServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.js";
import { createApiHandler } from "./api.js";
import { assertContentDocuments, createContentRepositories } from "./content-repositories.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST;
const hmrHost = process.env.HMR_HOST ?? host ?? "127.0.0.1";
const production = process.env.NODE_ENV === "production";
const db = openDatabase();
const {
  storyRepository: repository,
  worldRepository,
  buildingRepository,
  characterRepository,
} = createContentRepositories(db);
assertContentDocuments({
  storyRepository: repository,
  worldRepository,
  buildingRepository,
  characterRepository,
});
const api = createApiHandler(
  repository,
  worldRepository,
  buildingRepository,
  characterRepository,
  { syncRuntimeContentOnMutation: !production },
);

let vite = null;
if (!production) {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    server: {
      middlewareMode: true,
      hmr: {
        host: hmrHost,
        port: Number(process.env.HMR_PORT ?? 24678),
      },
    },
    appType: "spa",
  });
}

const requestHandler = async (req, res) => {
  if (await api.handle(req, res)) return;
  if (vite) {
    vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end("Not found");
    });
    return;
  }
  serveProduction(req, res);
};

const servers = [];
if (host) {
  listen(host);
} else {
  listen("127.0.0.1");
  listen("::1", { optional: true, label: "localhost IPv6" });
}

function listen(hostname, { optional = false, label = hostname } = {}) {
  const server = createHttpServer(requestHandler);
  servers.push(server);
  server.on("error", (error) => {
    if (optional) {
      console.warn(`Optional ${label} listener unavailable: ${error.message}`);
      return;
    }
    throw error;
  });
  server.listen(port, hostname, () => {
    const displayHost = hostname === "::1" ? "[::1]" : hostname;
    logRoutes(displayHost);
    if (hostname === "127.0.0.1") {
      logRoutes("localhost");
    }
  });
}

function logRoutes(displayHost) {
  console.log(`Atomic Adventures: http://${displayHost}:${port}`);
  console.log(`Story builder:     http://${displayHost}:${port}/builder/story`);
  console.log(`World builder:     http://${displayHost}:${port}/builder/world`);
  console.log(`Content builder:   http://${displayHost}:${port}/builder/content`);
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  api.close();
  await vite?.close();
  db.close();
  let remaining = servers.length;
  for (const server of servers) {
    server.close(() => {
      remaining -= 1;
      if (remaining <= 0) process.exit(0);
    });
  }
  if (!remaining) process.exit(0);
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
