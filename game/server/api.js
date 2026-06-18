import { publicWorldCatalog } from "./world-catalog.js";
import { exportBeatYaml } from "./story-yaml.js";

export function createApiHandler(repository, world) {
  const clients = new Set();

  function broadcast(payload) {
    const message = `event: story.updated\ndata: ${JSON.stringify(payload)}\n\n`;
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
          world: publicWorldCatalog(world),
        });
      }
      if (req.method === "GET" && url.pathname === "/api/content/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(`event: ready\ndata: ${JSON.stringify({ revision: repository.getGlobalRevision() })}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return true;
      }

      const listMatch = url.pathname.match(/^\/api\/story\/areas\/([^/]+)\/beats$/);
      if (listMatch && req.method === "GET") {
        return json(res, 200, repository.listBeats(decodeURIComponent(listMatch[1])));
      }
      if (listMatch && req.method === "POST") {
        const areaId = decodeURIComponent(listMatch[1]);
        const result = repository.createBeat(areaId, await readJson(req));
        broadcast({ revision: result.revision, areaId, beatId: result.beat.id });
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
          broadcast({ revision: result.revision, areaId, beatId });
          return json(res, 200, { ...result, yaml: exportBeatYaml(result.beat) });
        }
        if (req.method === "DELETE") {
          const body = await readJson(req);
          const result = repository.deleteBeat(areaId, beatId, body.expectedVersion);
          broadcast({ revision: result.revision, areaId, beatId, deleted: true });
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
        broadcast({ revision: result.revision, areaId, beatId });
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
