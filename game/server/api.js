import { publicWorldCatalog } from "./world-catalog.js";
import { exportBeatYaml } from "./story-yaml.js";
import { exportWorldYaml } from "./world-yaml.js";

export function createApiHandler(repository, worldRepository) {
  const clients = new Set();

  function broadcast(event, payload) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const response of clients) response.write(message);
  }

  async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) return false;

    try {
      if (req.method === "GET" && url.pathname === "/api/story") {
        return json(res, 200, repository.getRuntimeStory());
      }
      if (req.method === "GET" && url.pathname === "/api/catalog") {
        return json(res, 200, {
          areas: repository.listAreas(),
          world: publicWorldCatalog(worldRepository.getCatalog()),
        });
      }
      if (req.method === "GET" && url.pathname === "/api/content/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(`event: ready\ndata: ${JSON.stringify({
          storyRevision: repository.getGlobalRevision(),
          worldRevision: worldRepository.getGlobalRevision(),
        })}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return true;
      }

      if (req.method === "GET" && url.pathname === "/api/world/outdoors") {
        const result = worldRepository.getDocument();
        return json(res, 200, {
          ...result,
          warnings: worldRepository.validate(result.world).warnings,
          yaml: exportWorldYaml(result.world),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/world/outdoors/validate") {
        const body = await readJson(req);
        const result = worldRepository.validate(body.world ?? body);
        return json(res, result.valid ? 200 : 422, {
          valid: result.valid,
          errors: result.errors,
          warnings: result.warnings,
          world: result.world,
        });
      }
      if (req.method === "POST" && url.pathname === "/api/world/outdoors/rename-preview") {
        const body = await readJson(req);
        return json(res, 200, worldRepository.previewHexRename(body.from, body.to, body.world));
      }
      if (req.method === "PUT" && url.pathname === "/api/world/outdoors") {
        const body = await readJson(req);
        const result = worldRepository.save(body.world, body.expectedVersion, body.renames ?? []);
        repository.setWorld(worldRepository.getCatalog());
        broadcast("world.updated", {
          revision: result.revision,
          worldId: "outdoor-main",
          changedObjectIds: result.changedObjectIds,
        });
        if (result.story.affected?.length) {
          broadcast("story.updated", {
            revision: result.story.revision,
            affected: result.story.affected,
          });
        }
        return json(res, 200, { ...result, yaml: exportWorldYaml(result.world) });
      }
      if (req.method === "GET" && url.pathname === "/api/world/outdoors/revisions") {
        return json(res, 200, worldRepository.listRevisions());
      }
      const worldRestoreMatch = url.pathname.match(
        /^\/api\/world\/outdoors\/revisions\/(\d+)\/restore$/,
      );
      if (worldRestoreMatch && req.method === "POST") {
        const result = worldRepository.restore(worldRestoreMatch[1]);
        repository.setWorld(worldRepository.getCatalog());
        broadcast("world.updated", {
          revision: result.revision,
          worldId: "outdoor-main",
          changedObjectIds: result.changedObjectIds,
        });
        return json(res, 200, { ...result, yaml: exportWorldYaml(result.world) });
      }

      const listMatch = url.pathname.match(/^\/api\/story\/areas\/([^/]+)\/beats$/);
      if (listMatch && req.method === "GET") {
        return json(res, 200, repository.listBeats(decodeURIComponent(listMatch[1])));
      }
      if (listMatch && req.method === "POST") {
        const areaId = decodeURIComponent(listMatch[1]);
        const result = repository.createBeat(areaId, await readJson(req));
        broadcast("story.updated", { revision: result.revision, areaId, beatId: result.beat.id });
        return json(res, 201, { ...result, yaml: exportBeatYaml(result.beat) });
      }

      const beatMatch = url.pathname.match(/^\/api\/story\/areas\/([^/]+)\/beats\/([^/]+)$/);
      if (beatMatch) {
        const areaId = decodeURIComponent(beatMatch[1]);
        const beatId = decodeURIComponent(beatMatch[2]);
        if (req.method === "GET") {
          const beat = repository.getBeat(areaId, beatId);
          if (!beat) return json(res, 404, { message: "Beat not found." });
          return json(res, 200, { beat, yaml: exportBeatYaml(beat) });
        }
        if (req.method === "PUT") {
          const body = await readJson(req);
          const result = repository.updateBeat(areaId, beatId, body.beat ?? body, body.expectedVersion);
          broadcast("story.updated", { revision: result.revision, areaId, beatId });
          return json(res, 200, { ...result, yaml: exportBeatYaml(result.beat) });
        }
        if (req.method === "DELETE") {
          const body = await readJson(req);
          const result = repository.deleteBeat(areaId, beatId, body.expectedVersion);
          broadcast("story.updated", { revision: result.revision, areaId, beatId, deleted: true });
          return json(res, 200, result);
        }
      }

      const revisionsMatch = url.pathname.match(
        /^\/api\/story\/areas\/([^/]+)\/beats\/([^/]+)\/revisions$/,
      );
      if (revisionsMatch && req.method === "GET") {
        return json(res, 200, repository.listRevisions(
          decodeURIComponent(revisionsMatch[1]),
          decodeURIComponent(revisionsMatch[2]),
        ));
      }

      const restoreMatch = url.pathname.match(
        /^\/api\/story\/areas\/([^/]+)\/beats\/([^/]+)\/revisions\/(\d+)\/restore$/,
      );
      if (restoreMatch && req.method === "POST") {
        const areaId = decodeURIComponent(restoreMatch[1]);
        const beatId = decodeURIComponent(restoreMatch[2]);
        const result = repository.restoreRevision(areaId, beatId, restoreMatch[3]);
        broadcast("story.updated", { revision: result.revision, areaId, beatId });
        return json(res, 200, { ...result, yaml: exportBeatYaml(result.beat) });
      }

      return json(res, 404, { message: "API route not found." });
    } catch (error) {
      const status = error.status ?? 500;
      if (status === 500) console.error(error);
      return json(res, status, {
        message: error.message ?? "Unexpected server error.",
        errors: error.errors,
        current: error.current,
      });
    }
  }

  return { handle, close: () => clients.forEach((response) => response.end()) };
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  return body ? JSON.parse(body) : {};
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
  return true;
}
