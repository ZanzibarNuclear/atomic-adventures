import { json, readJson } from "./api-utils.js";
import { normalizeStoryArcContent } from "../src/composables/storyArcModel.js";

export async function handleStoryArcRoutes(req, res, url, {
  repository,
  storyArcRepository,
  broadcast,
  syncRuntimeContent,
}) {
  if (req.method === "GET" && url.pathname === "/api/story-arcs") {
    const result = storyArcRepository?.getDocument();
    if (!result) return json(res, 404, { message: "Story arc content not found." });
    const storyDocument = repository?.getRuntimeStory?.() ?? {};
    const storyBeats = Object.assign(
      {},
      ...Object.values(storyDocument.areas ?? {}).map((area) => area.beats ?? {}),
    );
    return json(res, 200, {
      story: normalizeStoryArcContent(result.storyArcDocument, {
        storyData: { beats: storyBeats },
      }),
      version: result.version,
      revision: result.revision,
      warnings: storyArcRepository.validate(result.storyArcDocument).warnings,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/story-arcs/document") {
    const result = storyArcRepository?.getDocument();
    if (!result) return json(res, 404, { message: "Story arc content not found." });
    return json(res, 200, {
      ...result,
      warnings: storyArcRepository.validate(result.storyArcDocument).warnings,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/story-arcs/document/validate") {
    if (!storyArcRepository) return json(res, 404, { message: "Story arc content not found." });
    const body = await readJson(req);
    const result = storyArcRepository.validate(body.storyArcDocument ?? body);
    return json(res, result.valid ? 200 : 422, result);
  }

  if (req.method === "PUT" && url.pathname === "/api/story-arcs/document") {
    if (!storyArcRepository) return json(res, 404, { message: "Story arc content not found." });
    const body = await readJson(req);
    const result = storyArcRepository.save(body.storyArcDocument ?? body, body.expectedVersion);
    syncRuntimeContent?.();
    broadcast("story-arcs.updated", { revision: result.revision });
    return json(res, 200, result);
  }

  if (req.method === "POST" && url.pathname === "/api/story-arcs/document/split-beat") {
    if (!storyArcRepository) return json(res, 404, { message: "Story arc content not found." });
    const body = await readJson(req);
    const result = storyArcRepository.splitBeatScenes(body);
    syncRuntimeContent?.();
    broadcast("story.updated", { revision: result.storyRevision, areaId: body.areaId, splitBeat: body.beatId });
    broadcast("story-arcs.updated", { revision: result.revision, splitBeat: body.beatId });
    return json(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/story-arcs/document/revisions") {
    if (!storyArcRepository) return json(res, 404, { message: "Story arc content not found." });
    return json(res, 200, storyArcRepository.listRevisions());
  }

  const restoreMatch = url.pathname.match(/^\/api\/story-arcs\/document\/revisions\/(\d+)\/restore$/);
  if (restoreMatch && req.method === "POST") {
    if (!storyArcRepository) return json(res, 404, { message: "Story arc content not found." });
    const result = storyArcRepository.restore(restoreMatch[1]);
    syncRuntimeContent?.();
    broadcast("story-arcs.updated", { revision: result.revision, restored: true });
    return json(res, 200, result);
  }

  return false;
}
