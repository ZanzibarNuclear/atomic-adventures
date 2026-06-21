import { decodePathPart, json, readJson } from "./api-utils.js";
import { exportBeatYaml } from "./story-yaml.js";

export async function handleStoryRoutes(req, res, url, {
  repository,
  broadcast,
}) {
  const listMatch = url.pathname.match(/^\/api\/story\/areas\/([^/]+)\/beats$/);
  if (listMatch && req.method === "GET") {
    return json(res, 200, repository.listBeats(decodePathPart(listMatch[1])));
  }
  if (listMatch && req.method === "POST") {
    const areaId = decodePathPart(listMatch[1]);
    const result = repository.createBeat(areaId, await readJson(req));
    broadcast("story.updated", { revision: result.revision, areaId, beatId: result.beat.id });
    return json(res, 201, { ...result, yaml: exportBeatYaml(result.beat) });
  }

  const beatMatch = url.pathname.match(/^\/api\/story\/areas\/([^/]+)\/beats\/([^/]+)$/);
  if (beatMatch) {
    const areaId = decodePathPart(beatMatch[1]);
    const beatId = decodePathPart(beatMatch[2]);
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
      decodePathPart(revisionsMatch[1]),
      decodePathPart(revisionsMatch[2]),
    ));
  }

  const restoreMatch = url.pathname.match(
    /^\/api\/story\/areas\/([^/]+)\/beats\/([^/]+)\/revisions\/(\d+)\/restore$/,
  );
  if (restoreMatch && req.method === "POST") {
    const areaId = decodePathPart(restoreMatch[1]);
    const beatId = decodePathPart(restoreMatch[2]);
    const result = repository.restoreRevision(areaId, beatId, restoreMatch[3]);
    broadcast("story.updated", { revision: result.revision, areaId, beatId });
    return json(res, 200, { ...result, yaml: exportBeatYaml(result.beat) });
  }

  return false;
}
