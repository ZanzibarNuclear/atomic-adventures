import { publicWorldCatalog } from "./world-catalog.js";
import { exportBeatYaml } from "./story-yaml.js";
import { exportWorldYaml } from "./world-yaml.js";

export function createApiHandler(
  repository,
  worldRepository,
  buildingRepository = null,
  characterRepository = null,
) {
  const clients = new Set();
  characterRepository?.setIntegrationValidator?.((character) => {
    const story = repository.validateAgainstCharacter?.(character) ?? {
      valid: true,
      errors: {},
    };
    const buildingDocument = buildingRepository?.getDocument?.();
    const building = buildingDocument
      ? buildingRepository.validate(buildingDocument.building, { character })
      : { valid: true, errors: {}, warnings: [] };
    return {
      valid: story.valid && building.valid,
      errors: {
        ...story.errors,
        ...Object.fromEntries(
          Object.entries(building.errors ?? {})
            .map(([path, messages]) => [`building.${path}`, messages]),
        ),
      },
      warnings: building.warnings ?? [],
    };
  });

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
          character: characterRepository?.getDocument()?.character ?? null,
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
          characterRevision: characterRepository?.getGlobalRevision() ?? 0,
        })}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return true;
      }

      if (req.method === "GET" && url.pathname === "/api/character") {
        const result = characterRepository?.getDocument();
        if (!result) return json(res, 404, { message: "Character content not found." });
        return json(res, 200, {
          ...result,
          warnings: characterRepository.validate(result.character).warnings,
        });
      }
      if (req.method === "GET" && url.pathname === "/api/character/references") {
        const domain = url.searchParams.get("domain");
        const id = url.searchParams.get("id");
        if (!domain || !id) {
          return json(res, 400, { message: "domain and id are required." });
        }
        return json(res, 200, [
          ...(repository.findCharacterReferences?.(domain, id) ?? []),
          ...(buildingRepository?.findCharacterReferences?.(domain, id) ?? []),
        ]);
      }
      if (req.method === "POST" && url.pathname === "/api/character/validate") {
        if (!characterRepository) return json(res, 404, { message: "Character content not found." });
        const body = await readJson(req);
        const result = characterRepository.validate(body.character ?? body);
        return json(res, result.valid ? 200 : 422, result);
      }
      if (req.method === "PUT" && url.pathname === "/api/character") {
        if (!characterRepository) return json(res, 404, { message: "Character content not found." });
        const body = await readJson(req);
        const result = characterRepository.save(
          body.character ?? body,
          body.expectedVersion,
        );
        repository.setCharacter?.(result.character);
        broadcast("character.updated", { revision: result.revision });
        return json(res, 200, result);
      }
      if (req.method === "GET" && url.pathname === "/api/character/revisions") {
        if (!characterRepository) return json(res, 404, { message: "Character content not found." });
        return json(res, 200, characterRepository.listRevisions());
      }
      const characterRestoreMatch = url.pathname.match(
        /^\/api\/character\/revisions\/(\d+)\/restore$/,
      );
      if (characterRestoreMatch && req.method === "POST") {
        if (!characterRepository) return json(res, 404, { message: "Character content not found." });
        const result = characterRepository.restore(characterRestoreMatch[1]);
        repository.setCharacter?.(result.character);
        broadcast("character.updated", { revision: result.revision, restored: true });
        return json(res, 200, result);
      }

      if (req.method === "GET" && url.pathname === "/api/world/outdoors") {
        const result = worldRepository.getDocument();
        return json(res, 200, {
          ...result,
          warnings: worldRepository.validate(result.world).warnings,
          yaml: exportWorldYaml(result.world),
        });
      }
      const buildingMatch = url.pathname.match(/^\/api\/world\/buildings\/([^/]+)$/);
      if (buildingMatch && req.method === "GET") {
        const id = decodeURIComponent(buildingMatch[1]);
        const result = buildingRepository?.getDocument(id);
        if (!result) return json(res, 404, { message: "Building not found." });
        return json(res, 200, {
          ...result,
          warnings: buildingRepository.validate(result.building).warnings,
        });
      }
      const buildingValidateMatch = url.pathname.match(
        /^\/api\/world\/buildings\/([^/]+)\/validate$/,
      );
      if (buildingValidateMatch && req.method === "POST") {
        const body = await readJson(req);
        const result = buildingRepository.validate(body.building ?? body);
        return json(res, result.valid ? 200 : 422, result);
      }
      const buildingRenameMatch = url.pathname.match(
        /^\/api\/world\/buildings\/([^/]+)\/rename-preview$/,
      );
      if (buildingRenameMatch && req.method === "POST") {
        const body = await readJson(req);
        return json(res, 200, buildingRepository.previewRename(
          decodeURIComponent(buildingRenameMatch[1]),
          body.kind,
          body.from,
          body.to,
          body.building,
        ));
      }
      if (buildingMatch && req.method === "PUT") {
        const id = decodeURIComponent(buildingMatch[1]);
        const body = await readJson(req);
        const result = buildingRepository.save(
          id,
          body.building ?? body,
          body.expectedVersion,
          body.renames ?? [],
        );
        worldRepository.setBuildingData(result.building);
        repository.setWorld(worldRepository.getCatalog(result.building));
        broadcast("building.updated", {
          revision: result.revision,
          buildingId: id,
          changedObjectIds: result.changedObjectIds,
        });
        if (result.story.affected?.length) {
          broadcast("story.updated", {
            revision: result.story.revision,
            affected: result.story.affected,
          });
        }
        return json(res, 200, result);
      }
      const buildingRevisionsMatch = url.pathname.match(
        /^\/api\/world\/buildings\/([^/]+)\/revisions$/,
      );
      if (buildingRevisionsMatch && req.method === "GET") {
        return json(res, 200, buildingRepository.listRevisions(
          decodeURIComponent(buildingRevisionsMatch[1]),
        ));
      }
      const buildingRestoreMatch = url.pathname.match(
        /^\/api\/world\/buildings\/([^/]+)\/revisions\/(\d+)\/restore$/,
      );
      if (buildingRestoreMatch && req.method === "POST") {
        const id = decodeURIComponent(buildingRestoreMatch[1]);
        const result = buildingRepository.restore(id, buildingRestoreMatch[2]);
        worldRepository.setBuildingData(result.building);
        repository.setWorld(worldRepository.getCatalog(result.building));
        broadcast("building.updated", {
          revision: result.revision,
          buildingId: id,
          changedObjectIds: result.changedObjectIds,
        });
        return json(res, 200, result);
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
