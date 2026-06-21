import { decodePathPart, json, readJson } from "./api-utils.js";
import { exportWorldYaml } from "./world-yaml.js";

export async function handleWorldRoutes(req, res, url, {
  repository,
  worldRepository,
  buildingRepository,
  broadcast,
}) {
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
    const id = decodePathPart(buildingMatch[1]);
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
      decodePathPart(buildingRenameMatch[1]),
      body.kind,
      body.from,
      body.to,
      body.building,
    ));
  }

  if (buildingMatch && req.method === "PUT") {
    const id = decodePathPart(buildingMatch[1]);
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
      decodePathPart(buildingRevisionsMatch[1]),
    ));
  }

  const buildingRestoreMatch = url.pathname.match(
    /^\/api\/world\/buildings\/([^/]+)\/revisions\/(\d+)\/restore$/,
  );
  if (buildingRestoreMatch && req.method === "POST") {
    const id = decodePathPart(buildingRestoreMatch[1]);
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

  return false;
}
