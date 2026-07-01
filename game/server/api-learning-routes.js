import { json, readJson } from "./api-utils.js";

export async function handleLearningRoutes(req, res, url, {
  repository,
  learningRepository,
  broadcast,
  syncRuntimeContent,
}) {
  if (req.method === "GET" && url.pathname === "/api/learning") {
    const result = learningRepository?.getDocument();
    if (!result) return json(res, 404, { message: "Learning content not found." });
    return json(res, 200, {
      ...result,
      warnings: learningRepository.validate(result.learning).warnings,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/learning/validate") {
    if (!learningRepository) return json(res, 404, { message: "Learning content not found." });
    const body = await readJson(req);
    const result = learningRepository.validate(body.learning ?? body);
    return json(res, result.valid ? 200 : 422, result);
  }

  if (req.method === "PUT" && url.pathname === "/api/learning") {
    if (!learningRepository) return json(res, 404, { message: "Learning content not found." });
    const body = await readJson(req);
    const result = learningRepository.save(body.learning ?? body, body.expectedVersion);
    repository.setLearning?.(result.learning);
    syncRuntimeContent?.();
    broadcast("learning.updated", { revision: result.revision });
    return json(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/learning/revisions") {
    if (!learningRepository) return json(res, 404, { message: "Learning content not found." });
    return json(res, 200, learningRepository.listRevisions());
  }

  const restoreMatch = url.pathname.match(/^\/api\/learning\/revisions\/(\d+)\/restore$/);
  if (restoreMatch && req.method === "POST") {
    if (!learningRepository) return json(res, 404, { message: "Learning content not found." });
    const result = learningRepository.restore(restoreMatch[1]);
    repository.setLearning?.(result.learning);
    syncRuntimeContent?.();
    broadcast("learning.updated", { revision: result.revision, restored: true });
    return json(res, 200, result);
  }

  return false;
}
