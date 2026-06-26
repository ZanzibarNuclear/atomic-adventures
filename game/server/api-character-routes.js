import { json, readJson } from "./api-utils.js";

export async function handleCharacterRoutes(req, res, url, {
  repository,
  buildingRepository,
  characterRepository,
  broadcast,
  syncRuntimeContent,
}) {
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
    syncRuntimeContent?.();
    broadcast("character.updated", { revision: result.revision });
    return json(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/character/revisions") {
    if (!characterRepository) return json(res, 404, { message: "Character content not found." });
    return json(res, 200, characterRepository.listRevisions());
  }

  const restoreMatch = url.pathname.match(/^\/api\/character\/revisions\/(\d+)\/restore$/);
  if (restoreMatch && req.method === "POST") {
    if (!characterRepository) return json(res, 404, { message: "Character content not found." });
    const result = characterRepository.restore(restoreMatch[1]);
    repository.setCharacter?.(result.character);
    syncRuntimeContent?.();
    broadcast("character.updated", { revision: result.revision, restored: true });
    return json(res, 200, result);
  }

  return false;
}
