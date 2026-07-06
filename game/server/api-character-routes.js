import { json, readJson } from "./api-utils.js";
import { applyBuildingCharacterRenames } from "./building-model.js";
import { applyCharacterRenames, validateCharacterDocument } from "./character-model.js";
import { listPublicImages } from "./public-asset-catalog.js";
import { OUTDOOR_WORLD_ID } from "./world-repository.js";
import { applyWorldCharacterRenames, validateWorld } from "./world-model.js";

export async function handleCharacterRoutes(req, res, url, {
  repository,
  worldRepository,
  buildingRepository,
  characterRepository,
  learningRepository,
  storylineRepository,
  broadcast,
  syncRuntimeContent,
}) {
  if (req.method === "GET" && url.pathname === "/api/character/public-images") {
    const folder = url.searchParams.get("folder") ?? "items";
    try {
      return json(res, 200, { folder, images: listPublicImages(folder) });
    } catch (error) {
      return json(res, 400, { message: error.message });
    }
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
      ...(storylineRepository?.findCharacterReferences?.(domain, id) ?? []),
      ...(buildingRepository?.findCharacterReferences?.(domain, id) ?? []),
      ...(learningRepository?.findCharacterReferences?.(domain, id) ?? []),
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
    const currentCharacter = characterRepository.getDocument()?.character;
    const renames = mergeCharacterRenames(
      normalizeCharacterRenames(body.renames),
      inferCharacterRenames(currentCharacter, body.character ?? body),
    );
    const worldDocument = worldRepository?.getDocument?.();
    const buildingDocument = buildingRepository?.getDocument?.();
    const characterInput = applyCharacterRenames(
      structuredClone(body.character ?? body),
      renames,
    );
    const worldCandidate = worldDocument
      ? applyWorldCharacterRenames(structuredClone(worldDocument.world), renames)
      : null;
    const buildingCandidate = buildingDocument
      ? applyBuildingCharacterRenames(structuredClone(buildingDocument.building), renames)
      : null;
    const result = characterRepository.save(
      characterInput,
      body.expectedVersion,
      {
        validate: (character) => validateCharacterCascade({
          character,
          repository,
          buildingRepository,
          buildingCandidate,
          worldCandidate,
        }),
        afterSave: () => {
          saveCascadedWorld({ worldRepository, worldDocument, worldCandidate });
          saveCascadedBuilding({ buildingRepository, buildingDocument, buildingCandidate });
        },
      },
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

function normalizeCharacterRenames(value) {
  return Array.isArray(value)
    ? value
      .map((rename) => ({
        domain: String(rename?.domain ?? "").trim(),
        from: String(rename?.from ?? "").trim(),
        to: String(rename?.to ?? "").trim(),
      }))
      .filter((rename) => rename.domain && rename.from && rename.to && rename.from !== rename.to)
    : [];
}

function mergeCharacterRenames(...groups) {
  const seen = new Set();
  return groups.flat().filter((rename) => {
    const key = `${rename.domain}:${rename.from}:${rename.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferCharacterRenames(before = {}, after = {}) {
  const renames = [];
  for (const domain of ["items", "stats", "knowledge", "skills", "quests", "documents"]) {
    const beforeIds = new Set((before[domain] ?? []).map((entry) => entry.id));
    const afterIds = new Set((after[domain] ?? []).map((entry) => entry.id));
    const removed = [...beforeIds].filter((id) => !afterIds.has(id));
    const added = [...afterIds].filter((id) => !beforeIds.has(id));
    if (removed.length === 1 && added.length === 1) {
      renames.push({ domain, from: removed[0], to: added[0] });
    }
  }
  return renames;
}

function validateCharacterCascade({
  character,
  repository,
  buildingRepository,
  buildingCandidate,
  worldCandidate,
}) {
  const base = validateCharacterDocument(character);
  if (!base.valid) return base;
  const story = repository.validateAgainstCharacter?.(base.character) ?? { valid: true, errors: {} };
  const building = buildingCandidate
    ? buildingRepository.validate(buildingCandidate, { character: base.character })
    : { valid: true, errors: {}, warnings: [] };
  const world = worldCandidate ? validateWorld(worldCandidate) : { valid: true, errors: {}, warnings: [] };
  const errors = {
    ...story.errors,
    ...Object.fromEntries(
      Object.entries(building.errors ?? {})
        .map(([path, messages]) => [`building.${path}`, messages]),
    ),
    ...Object.fromEntries(
      Object.entries(world.errors ?? {})
        .map(([path, messages]) => [`world.${path}`, messages]),
    ),
  };
  return {
    character: base.character,
    errors,
    warnings: [
      ...(base.warnings ?? []),
      ...(building.warnings ?? []),
      ...(world.warnings ?? []).map((warning) => ({ ...warning, path: `world.${warning.path}` })),
    ],
    valid: story.valid !== false && building.valid && world.valid && Object.keys(errors).length === 0,
  };
}

function saveCascadedWorld({ worldRepository, worldDocument, worldCandidate }) {
  if (!worldRepository || !worldDocument || !worldCandidate) return;
  if (JSON.stringify(worldCandidate) === JSON.stringify(worldDocument.world)) return;
  const nextVersion = worldDocument.version + 1;
  worldRepository.documents.update(OUTDOOR_WORLD_ID, worldCandidate, nextVersion);
  worldRepository.revisions.record(OUTDOOR_WORLD_ID, "update", worldCandidate);
  worldRepository.revisions.incrementGlobalRevision();
}

function saveCascadedBuilding({ buildingRepository, buildingDocument, buildingCandidate }) {
  if (!buildingRepository || !buildingDocument || !buildingCandidate) return;
  if (JSON.stringify(buildingCandidate) === JSON.stringify(buildingDocument.building)) return;
  const nextVersion = buildingDocument.version + 1;
  buildingRepository.documents.update(buildingCandidate.id, buildingCandidate, nextVersion);
  buildingRepository.revisions.record(buildingCandidate.id, "update", buildingCandidate);
  buildingRepository.revisions.incrementGlobalRevision();
}
