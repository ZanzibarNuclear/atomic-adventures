import { json, readJson } from "./api-utils.js";

export async function handleStorylineRoutes(req, res, url, {
  storylineRepository,
  broadcast,
  syncRuntimeContent,
}) {
  if (req.method === "GET" && url.pathname === "/api/storyline") {
    const result = storylineRepository?.getDocument();
    if (!result) return json(res, 404, { message: "Storyline content not found." });
    return json(res, 200, {
      ...result,
      warnings: storylineRepository.validate(result.storyline).warnings,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/storyline/validate") {
    if (!storylineRepository) return json(res, 404, { message: "Storyline content not found." });
    const body = await readJson(req);
    const result = storylineRepository.validate(body.storyline ?? body);
    return json(res, result.valid ? 200 : 422, result);
  }

  if (req.method === "PUT" && url.pathname === "/api/storyline") {
    if (!storylineRepository) return json(res, 404, { message: "Storyline content not found." });
    const body = await readJson(req);
    const result = storylineRepository.save(body.storyline ?? body, body.expectedVersion);
    syncRuntimeContent?.();
    broadcast("storyline.updated", { revision: result.revision });
    return json(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/storyline/revisions") {
    if (!storylineRepository) return json(res, 404, { message: "Storyline content not found." });
    return json(res, 200, storylineRepository.listRevisions());
  }

  const restoreMatch = url.pathname.match(/^\/api\/storyline\/revisions\/(\d+)\/restore$/);
  if (restoreMatch && req.method === "POST") {
    if (!storylineRepository) return json(res, 404, { message: "Storyline content not found." });
    const result = storylineRepository.restore(restoreMatch[1]);
    syncRuntimeContent?.();
    broadcast("storyline.updated", { revision: result.revision, restored: true });
    return json(res, 200, result);
  }

  return false;
}
