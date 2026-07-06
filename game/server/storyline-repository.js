import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { RevisionStore } from "./revision-store.js";
import { validateStorylineDocument } from "./storyline-model.js";

export const STORYLINE_DOCUMENT_ID = "storyline-main";

export class StorylineRepository {
  constructor(db, {
    seedStoryline = null,
    storyRepository = null,
    worldRepository = null,
    characterRepository = null,
    learningRepository = null,
  } = {}) {
    this.db = db;
    this.storyRepository = storyRepository;
    this.worldRepository = worldRepository;
    this.characterRepository = characterRepository;
    this.learningRepository = learningRepository;
    this.revisions = new RevisionStore(db, {
      table: "storyline_revisions",
      idColumn: "storyline_id",
      metaKey: "storyline_revision",
    });
    if (seedStoryline) this.ensureSeed(seedStoryline);
  }

  setRepositories({
    storyRepository = this.storyRepository,
    worldRepository = this.worldRepository,
    characterRepository = this.characterRepository,
    learningRepository = this.learningRepository,
  } = {}) {
    this.storyRepository = storyRepository;
    this.worldRepository = worldRepository;
    this.characterRepository = characterRepository;
    this.learningRepository = learningRepository;
  }

  ensureSeed(seedStoryline) {
    if (this.getDocument()) return;
    const validation = this.validate(seedStoryline);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO storyline_documents(id, document_json, version, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `).run(STORYLINE_DOCUMENT_ID, JSON.stringify(validation.storyline), now, now);
      this.revisions.record(STORYLINE_DOCUMENT_ID, "import", validation.storyline);
      this.revisions.incrementGlobalRevision();
    });
  }

  getGlobalRevision() {
    return this.revisions.getGlobalRevision();
  }

  getDocument() {
    const row = this.db.prepare(`
      SELECT document_json, version, created_at AS createdAt, updated_at AS updatedAt
      FROM storyline_documents WHERE id = ?
    `).get(STORYLINE_DOCUMENT_ID);
    if (!row) return null;
    return {
      storyline: JSON.parse(row.document_json),
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getRuntimeStoryline() {
    const document = this.getDocument();
    return document ? {
      storyline: document.storyline,
      version: document.version,
      revision: document.revision,
      warnings: this.validate(document.storyline).warnings,
    } : null;
  }

  validate(input) {
    const building = this.worldRepository?.buildingData ?? null;
    return validateStorylineDocument(input, {
      story: this.storyRepository?.getRuntimeStory?.() ?? null,
      world: this.worldRepository?.getCatalog?.(building) ?? null,
      character: this.characterRepository?.getDocument?.()?.character ?? null,
      learning: this.learningRepository?.getDocument?.()?.learning ?? null,
    });
  }

  save(input, expectedVersion) {
    const existing = this.getDocument();
    if (!existing) throw new NotFoundError("Storyline content not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("Storyline content changed in another window.", existing);
    }
    const validation = this.validate(input);
    if (!validation.valid) throw new ValidationError(validation.errors);
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE storyline_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.storyline),
        nextVersion,
        new Date().toISOString(),
        STORYLINE_DOCUMENT_ID,
      );
      this.revisions.record(STORYLINE_DOCUMENT_ID, "update", validation.storyline);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        storyline: validation.storyline,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  listRevisions() {
    return this.revisions.list(STORYLINE_DOCUMENT_ID);
  }

  restore(revisionNumber) {
    const snapshot = this.revisions.getSnapshot(STORYLINE_DOCUMENT_ID, revisionNumber);
    if (!snapshot) throw new NotFoundError("Storyline revision not found.");
    const validation = this.validate(snapshot);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const existing = this.getDocument();
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.db.prepare(`
        UPDATE storyline_documents
        SET document_json = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(validation.storyline),
        nextVersion,
        new Date().toISOString(),
        STORYLINE_DOCUMENT_ID,
      );
      this.revisions.record(STORYLINE_DOCUMENT_ID, "restore", validation.storyline);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        storyline: validation.storyline,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  validateAgainstWorld(world, renames = []) {
    const document = this.getDocument();
    if (!document) return { valid: true, errors: {} };
    const storyline = applyStorylineRenames(document.storyline, renames);
    const validation = validateStorylineDocument(storyline, {
      story: this.storyRepository?.getRuntimeStory?.() ?? null,
      world,
      character: this.characterRepository?.getDocument?.()?.character ?? null,
      learning: this.learningRepository?.getDocument?.()?.learning ?? null,
    });
    return {
      valid: validation.valid,
      errors: Object.fromEntries(
        Object.entries(validation.errors).map(([path, messages]) => [`storyline.${path}`, messages]),
      ),
    };
  }

  findHexReferences(hexId) {
    return collectStorylineReferences(this.getDocument()?.storyline, ({ step, base, add }) => {
      collectListReferences(step.allowed?.movement?.hexes, hexId, `${base}.allowed.movement.hexes`, add);
      collectActionReferences(step.allowed?.storyForwardActions, hexId, "hex", `${base}.allowed.storyForwardActions`, add);
      collectActionReferences(step.allowed?.optionalActions, hexId, "hex", `${base}.allowed.optionalActions`, add);
      if (step.completesWhen?.location?.hex === hexId) add(`${base}.completesWhen.location.hex`);
      if (step.onEnter?.move?.hex === hexId) add(`${base}.onEnter.move.hex`);
      if (step.onComplete?.move?.hex === hexId) add(`${base}.onComplete.move.hex`);
    });
  }

  findBuildingReferences(kind, id) {
    const collection = kind === "room" ? "rooms" : "exteriorNodes";
    const actionKind = kind === "room" ? "room" : "exterior";
    const locationKey = kind === "room" ? "room" : "exteriorNode";
    return collectStorylineReferences(this.getDocument()?.storyline, ({ step, base, add }) => {
      collectListReferences(step.allowed?.movement?.[collection], id, `${base}.allowed.movement.${collection}`, add);
      collectActionReferences(step.allowed?.storyForwardActions, id, actionKind, `${base}.allowed.storyForwardActions`, add);
      collectActionReferences(step.allowed?.optionalActions, id, actionKind, `${base}.allowed.optionalActions`, add);
      if (step.completesWhen?.location?.[locationKey] === id) add(`${base}.completesWhen.location.${locationKey}`);
      if (step.onEnter?.move?.[locationKey] === id) add(`${base}.onEnter.move.${locationKey}`);
      if (step.onComplete?.move?.[locationKey] === id) add(`${base}.onComplete.move.${locationKey}`);
    });
  }

  findCharacterReferences(domain, id) {
    if (domain !== "items") return [];
    return collectStorylineReferences(this.getDocument()?.storyline, ({ step, base, add }) => {
      if (step.completesWhen?.holding?.item === id) add(`${base}.completesWhen.holding.item`);
    });
  }

  findLearningReferences(lessonId) {
    return collectStorylineReferences(this.getDocument()?.storyline, ({ step, base, add }) => {
      if (step.completesWhen?.lesson?.id === lessonId) add(`${base}.completesWhen.lesson.id`);
      (step.allowed?.stageViews ?? []).forEach((view, index) => {
        if (view.kind === "lesson" && view.id === lessonId) add(`${base}.allowed.stageViews.${index}.id`);
      });
      if (step.onEnter?.view?.kind === "lesson" && step.onEnter.view.id === lessonId) add(`${base}.onEnter.view.id`);
      if (step.onComplete?.view?.kind === "lesson" && step.onComplete.view.id === lessonId) {
        add(`${base}.onComplete.view.id`);
      }
    });
  }

  cascadeHexRenames(renames = [], world) {
    return this.#cascadeWorldRenames(renames.filter((rename) => rename?.kind === "hex"), world);
  }

  cascadeBuildingRenames(renames = [], world) {
    return this.#cascadeWorldRenames(
      renames.filter((rename) => rename?.kind === "room" || rename?.kind === "exteriorNode"),
      world,
    );
  }

  #cascadeWorldRenames(renames = [], world) {
    if (!renames.some((rename) => rename?.from && rename?.to)) {
      return { affected: [], revision: this.getGlobalRevision() };
    }
    const existing = this.getDocument();
    if (!existing) return { affected: [], revision: this.getGlobalRevision() };
    const storyline = applyStorylineRenames(existing.storyline, renames);
    if (JSON.stringify(storyline) === JSON.stringify(existing.storyline)) {
      return { affected: [], revision: this.getGlobalRevision() };
    }
    const validation = validateStorylineDocument(storyline, {
      story: this.storyRepository?.getRuntimeStory?.() ?? null,
      world,
      character: this.characterRepository?.getDocument?.()?.character ?? null,
      learning: this.learningRepository?.getDocument?.()?.learning ?? null,
    });
    if (!validation.valid) throw new ValidationError(validation.errors);
    const nextVersion = existing.version + 1;
    this.db.prepare(`
      UPDATE storyline_documents
      SET document_json = ?, version = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(validation.storyline),
      nextVersion,
      new Date().toISOString(),
      STORYLINE_DOCUMENT_ID,
    );
    this.revisions.record(STORYLINE_DOCUMENT_ID, "update", validation.storyline);
    const revision = this.revisions.incrementGlobalRevision();
    return {
      affected: affectedSteps(existing.storyline, validation.storyline),
      revision,
    };
  }
}

function collectStorylineReferences(storyline, collector) {
  const references = [];
  (storyline?.scenarios ?? []).forEach((scenario, scenarioIndex) => {
    (scenario.steps ?? []).forEach((step, stepIndex) => {
      const base = `scenarios.${scenarioIndex}.steps.${stepIndex}`;
      const add = (path) => references.push({
        kind: "storyline",
        scenarioId: scenario.id,
        stepId: step.id,
        path,
      });
      collector({ scenario, step, base, add });
    });
  });
  return references;
}

function collectListReferences(list = [], id, path, add) {
  (list ?? []).forEach((value, index) => {
    if (value === id) add(`${path}.${index}`);
  });
}

function collectActionReferences(actions = [], id, kind, path, add) {
  const prefixes = {
    hex: ["move-hex", "route", "barrier"],
    room: ["move-room"],
    exterior: ["move-exterior"],
  }[kind] ?? [];
  (actions ?? []).forEach((actionId, index) => {
    if (prefixes.some((prefix) => actionId === `${prefix}:${id}`)) add(`${path}.${index}`);
  });
}

function applyStorylineRenames(storyline, renames = []) {
  const next = structuredClone(storyline);
  const hexMap = renameMapFor(renames, "hex");
  const roomMap = renameMapFor(renames, "room");
  const exteriorMap = renameMapFor(renames, "exteriorNode");
  for (const scenario of next.scenarios ?? []) {
    for (const step of scenario.steps ?? []) {
      const movement = step.allowed?.movement;
      if (movement) {
        movement.hexes = (movement.hexes ?? []).map((id) => resolveRename(hexMap, id));
        movement.rooms = (movement.rooms ?? []).map((id) => resolveRename(roomMap, id));
        movement.exteriorNodes = (movement.exteriorNodes ?? []).map((id) => resolveRename(exteriorMap, id));
      }
      for (const key of ["storyForwardActions", "optionalActions"]) {
        if (Array.isArray(step.allowed?.[key])) {
          step.allowed[key] = step.allowed[key].map((id) => renameActionId(id, { hexMap, roomMap, exteriorMap }));
        }
      }
      renameLocation(step.completesWhen?.location, { hexMap, roomMap, exteriorMap });
      renameLocation(step.onEnter?.move, { hexMap, roomMap, exteriorMap });
      renameLocation(step.onComplete?.move, { hexMap, roomMap, exteriorMap });
    }
  }
  return next;
}

function renameLocation(location, maps) {
  if (!location) return;
  if (location.hex) location.hex = resolveRename(maps.hexMap, location.hex);
  if (location.room) location.room = resolveRename(maps.roomMap, location.room);
  if (location.exteriorNode) location.exteriorNode = resolveRename(maps.exteriorMap, location.exteriorNode);
}

function renameActionId(id, { hexMap, roomMap, exteriorMap }) {
  return renameActionPrefix(renameActionPrefix(renameActionPrefix(id, ["move-hex", "route", "barrier"], hexMap), ["move-room"], roomMap), ["move-exterior"], exteriorMap);
}

function renameActionPrefix(id, prefixes, map) {
  for (const prefix of prefixes) {
    const marker = `${prefix}:`;
    if (id?.startsWith(marker)) return `${marker}${resolveRename(map, id.slice(marker.length))}`;
  }
  return id;
}

function affectedSteps(before, after) {
  const affected = [];
  (before.scenarios ?? []).forEach((scenario, scenarioIndex) => {
    (scenario.steps ?? []).forEach((step, stepIndex) => {
      const nextStep = after.scenarios?.[scenarioIndex]?.steps?.[stepIndex];
      if (JSON.stringify(step) !== JSON.stringify(nextStep)) {
        affected.push({ scenarioId: scenario.id, stepId: step.id });
      }
    });
  });
  return affected;
}

function renameMapFor(renames, kind) {
  return new Map(
    renames
      .filter((rename) => rename?.kind === kind && rename.from && rename.to)
      .map((rename) => [String(rename.from), String(rename.to)]),
  );
}

function resolveRename(map, value) {
  let current = value;
  const seen = new Set();
  while (map.has(current) && !seen.has(current)) {
    seen.add(current);
    current = map.get(current);
  }
  return current;
}
