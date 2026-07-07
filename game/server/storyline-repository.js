import { transaction } from "./db.js";
import { ConflictError, NotFoundError, ValidationError } from "./story-repository.js";
import { RevisionStore } from "./revision-store.js";
import { validateStoryArcDocument } from "./storyline-model.js";

export const STORY_ARC_DOCUMENT_ID = "story-main";

export class StoryArcRepository {
  constructor(db, {
    seedStoryArcDocument = null,
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
    if (seedStoryArcDocument) this.ensureSeed(seedStoryArcDocument);
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

  ensureSeed(seedStoryArcDocument) {
    if (this.getDocument()) return;
    const validation = this.validate(seedStoryArcDocument);
    if (!validation.valid) throw new ValidationError(validation.errors);
    transaction(this.db, () => {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO storyline_documents(id, document_json, version, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?)
      `).run(STORY_ARC_DOCUMENT_ID, JSON.stringify(validation.storyArcDocument), now, now);
      this.revisions.record(STORY_ARC_DOCUMENT_ID, "import", validation.storyArcDocument);
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
    `).get(STORY_ARC_DOCUMENT_ID);
    if (!row) return null;
    return {
      storyArcDocument: JSON.parse(row.document_json),
      version: row.version,
      revision: this.getGlobalRevision(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getRuntimeStoryArcDocument() {
    const document = this.getDocument();
    return document ? {
      storyArcDocument: document.storyArcDocument,
      version: document.version,
      revision: document.revision,
      warnings: this.validate(document.storyArcDocument).warnings,
    } : null;
  }

  validate(input) {
    const building = this.worldRepository?.buildingData ?? null;
    return validateStoryArcDocument(input, {
      story: this.storyRepository?.getRuntimeStory?.() ?? null,
      world: this.worldRepository?.getCatalog?.(building) ?? null,
      character: this.characterRepository?.getDocument?.()?.character ?? null,
      learning: this.learningRepository?.getDocument?.()?.learning ?? null,
    });
  }

  save(input, expectedVersion) {
    const existing = this.getDocument();
    if (!existing) throw new NotFoundError("Story arc content not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("Story arc content changed in another window.", existing);
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
        JSON.stringify(validation.storyArcDocument),
        nextVersion,
        new Date().toISOString(),
        STORY_ARC_DOCUMENT_ID,
      );
      this.revisions.record(STORY_ARC_DOCUMENT_ID, "update", validation.storyArcDocument);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        storyArcDocument: validation.storyArcDocument,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  listRevisions() {
    return this.revisions.list(STORY_ARC_DOCUMENT_ID);
  }

  restore(revisionNumber) {
    const snapshot = this.revisions.getSnapshot(STORY_ARC_DOCUMENT_ID, revisionNumber);
    if (!snapshot) throw new NotFoundError("Story arc revision not found.");
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
        JSON.stringify(validation.storyArcDocument),
        nextVersion,
        new Date().toISOString(),
        STORY_ARC_DOCUMENT_ID,
      );
      this.revisions.record(STORY_ARC_DOCUMENT_ID, "restore", validation.storyArcDocument);
      const revision = this.revisions.incrementGlobalRevision();
      return {
        storyArcDocument: validation.storyArcDocument,
        version: nextVersion,
        revision,
        warnings: validation.warnings,
      };
    });
  }

  validateAgainstWorld(world, renames = []) {
    const document = this.getDocument();
    if (!document) return { valid: true, errors: {} };
    const storyArcDocument = applyStoryArcRenames(document.storyArcDocument, renames);
    const validation = validateStoryArcDocument(storyArcDocument, {
      story: this.storyRepository?.getRuntimeStory?.() ?? null,
      world,
      character: this.characterRepository?.getDocument?.()?.character ?? null,
      learning: this.learningRepository?.getDocument?.()?.learning ?? null,
    });
    return {
      valid: validation.valid,
      errors: Object.fromEntries(
        Object.entries(validation.errors).map(([path, messages]) => [`storyArcDocument.${path}`, messages]),
      ),
    };
  }

  findHexReferences(hexId) {
    return collectStoryArcReferences(this.getDocument()?.storyArcDocument, ({ beat, base, add }) => {
      collectListReferences(beat.allowed?.movement?.hexes, hexId, `${base}.allowed.movement.hexes`, add);
      collectActionReferences(beat.allowed?.storyForwardActions, hexId, "hex", `${base}.allowed.storyForwardActions`, add);
      collectActionReferences(beat.allowed?.optionalActions, hexId, "hex", `${base}.allowed.optionalActions`, add);
      if (beat.completesWhen?.location?.hex === hexId) add(`${base}.completesWhen.location.hex`);
      if (beat.onEnter?.move?.hex === hexId) add(`${base}.onEnter.move.hex`);
      if (beat.onComplete?.move?.hex === hexId) add(`${base}.onComplete.move.hex`);
    });
  }

  findBuildingReferences(kind, id) {
    const collection = kind === "room" ? "rooms" : "exteriorNodes";
    const actionKind = kind === "room" ? "room" : "exterior";
    const locationKey = kind === "room" ? "room" : "exteriorNode";
    return collectStoryArcReferences(this.getDocument()?.storyArcDocument, ({ beat, base, add }) => {
      collectListReferences(beat.allowed?.movement?.[collection], id, `${base}.allowed.movement.${collection}`, add);
      collectActionReferences(beat.allowed?.storyForwardActions, id, actionKind, `${base}.allowed.storyForwardActions`, add);
      collectActionReferences(beat.allowed?.optionalActions, id, actionKind, `${base}.allowed.optionalActions`, add);
      if (beat.completesWhen?.location?.[locationKey] === id) add(`${base}.completesWhen.location.${locationKey}`);
      if (beat.onEnter?.move?.[locationKey] === id) add(`${base}.onEnter.move.${locationKey}`);
      if (beat.onComplete?.move?.[locationKey] === id) add(`${base}.onComplete.move.${locationKey}`);
    });
  }

  findCharacterReferences(domain, id) {
    if (domain !== "items") return [];
    return collectStoryArcReferences(this.getDocument()?.storyArcDocument, ({ beat, base, add }) => {
      if (beat.completesWhen?.holding?.item === id) add(`${base}.completesWhen.holding.item`);
    });
  }

  findLearningReferences(lessonId) {
    return collectStoryArcReferences(this.getDocument()?.storyArcDocument, ({ beat, base, add }) => {
      if (beat.completesWhen?.lesson?.id === lessonId) add(`${base}.completesWhen.lesson.id`);
      (beat.allowed?.stageViews ?? []).forEach((view, index) => {
        if (view.kind === "lesson" && view.id === lessonId) add(`${base}.allowed.stageViews.${index}.id`);
      });
      if (beat.onEnter?.view?.kind === "lesson" && beat.onEnter.view.id === lessonId) add(`${base}.onEnter.view.id`);
      if (beat.onComplete?.view?.kind === "lesson" && beat.onComplete.view.id === lessonId) {
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
    const storyArcDocument = applyStoryArcRenames(existing.storyArcDocument, renames);
    if (JSON.stringify(storyArcDocument) === JSON.stringify(existing.storyArcDocument)) {
      return { affected: [], revision: this.getGlobalRevision() };
    }
    const validation = validateStoryArcDocument(storyArcDocument, {
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
      JSON.stringify(validation.storyArcDocument),
      nextVersion,
      new Date().toISOString(),
      STORY_ARC_DOCUMENT_ID,
    );
    this.revisions.record(STORY_ARC_DOCUMENT_ID, "update", validation.storyArcDocument);
    const revision = this.revisions.incrementGlobalRevision();
    return {
      affected: affectedBeats(existing.storyArcDocument, validation.storyArcDocument),
      revision,
    };
  }
}

export const StorylineRepository = StoryArcRepository;

function collectStoryArcReferences(storyArcDocument, collector) {
  const references = [];
  (storyArcDocument?.storyArcs ?? []).forEach((arc, arcIndex) => {
    (arc.beats ?? []).forEach((beat, beatIndex) => {
      const base = `storyArcs.${arcIndex}.beats.${beatIndex}`;
      const add = (path) => references.push({
        kind: "storyArc",
        arcId: arc.id,
        beatId: beat.id,
        path,
      });
      collector({ arc, beat, base, add });
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

function applyStoryArcRenames(storyArcDocument, renames = []) {
  const next = structuredClone(storyArcDocument);
  const hexMap = renameMapFor(renames, "hex");
  const roomMap = renameMapFor(renames, "room");
  const exteriorMap = renameMapFor(renames, "exteriorNode");
  for (const arc of next.storyArcs ?? []) {
    for (const beat of arc.beats ?? []) {
      const movement = beat.allowed?.movement;
      if (movement) {
        movement.hexes = (movement.hexes ?? []).map((id) => resolveRename(hexMap, id));
        movement.rooms = (movement.rooms ?? []).map((id) => resolveRename(roomMap, id));
        movement.exteriorNodes = (movement.exteriorNodes ?? []).map((id) => resolveRename(exteriorMap, id));
      }
      for (const key of ["storyForwardActions", "optionalActions"]) {
        if (Array.isArray(beat.allowed?.[key])) {
          beat.allowed[key] = beat.allowed[key].map((id) => renameActionId(id, { hexMap, roomMap, exteriorMap }));
        }
      }
      renameLocation(beat.completesWhen?.location, { hexMap, roomMap, exteriorMap });
      renameLocation(beat.onEnter?.move, { hexMap, roomMap, exteriorMap });
      renameLocation(beat.onComplete?.move, { hexMap, roomMap, exteriorMap });
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

function affectedBeats(before, after) {
  const affected = [];
  (before.storyArcs ?? []).forEach((arc, arcIndex) => {
    (arc.beats ?? []).forEach((beat, beatIndex) => {
      const nextBeat = after.storyArcs?.[arcIndex]?.beats?.[beatIndex];
      if (JSON.stringify(beat) !== JSON.stringify(nextBeat)) {
        affected.push({ arcId: arc.id, beatId: beat.id });
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
