import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
import { beatToRuntime, normalizeBeat, validateBeat } from "./story-model.js";

export class StoryRepository {
  constructor(db, world, character = null) {
    this.db = db;
    this.world = world;
    this.character = character;
  }

  setWorld(world) {
    this.world = world;
  }

  setCharacter(character) {
    this.character = character;
  }

  getGlobalRevision() {
    return Number(
      this.db.prepare("SELECT value FROM content_meta WHERE key = 'story_revision'").get()?.value ?? 0,
    );
  }

  getRuntimeStory() {
    const areas = this.db.prepare(
      "SELECT id, name FROM story_areas ORDER BY sort_order, id",
    ).all();
    const result = {};
    for (const area of areas) {
      result[area.id] = {
        area: area.id,
        name: area.name,
        beats: Object.fromEntries(
          this.listBeats(area.id, { full: true }).map((beat) => [beat.id, beatToRuntime(beat)]),
        ),
      };
    }
    return { revision: this.getGlobalRevision(), areas: result };
  }

  listAreas() {
    return this.db.prepare(
      "SELECT id, name, sort_order AS sortOrder FROM story_areas ORDER BY sort_order, id",
    ).all();
  }

  listBeats(areaId, { full = false } = {}) {
    const rows = this.db.prepare(`
      SELECT area_id, id, sort_order, trigger_place, trigger_hex, trigger_room,
        trigger_exterior_node, trigger_event, trigger_flag, once_value, acknowledge,
        eyebrow, heading, text, revisit, require_all, require_any, require_not, require_json,
        version, created_at, updated_at
      FROM story_beats
      WHERE area_id = ?
      ORDER BY id
    `).all(areaId);
    return rows.map((row) => {
      const beat = this.#rowToBeat(row, full);
      if (!full) delete beat.choices;
      return beat;
    });
  }

  getBeat(areaId, beatId) {
    const row = this.db.prepare(`
      SELECT area_id, id, sort_order, trigger_place, trigger_hex, trigger_room,
        trigger_exterior_node, trigger_event, trigger_flag, once_value, acknowledge,
        eyebrow, heading, text, revisit, require_all, require_any, require_not, require_json,
        version, created_at, updated_at
      FROM story_beats
      WHERE area_id = ? AND id = ?
    `).get(areaId, beatId);
    return row ? this.#rowToBeat(row, true) : null;
  }

  createBeat(areaId, input) {
    const validation = validateBeat(input, this.world, this.character);
    if (!validation.valid) throw new ValidationError(validation.errors);
    if (this.getBeat(areaId, validation.beat.id)) {
      throw new ValidationError({ id: ["That beat ID already exists in this area."] });
    }
    return transaction(this.db, () => {
      this.#ensureArea(areaId);
      this.#insertBeat(areaId, validation.beat, 1);
      const saved = this.getBeat(areaId, validation.beat.id);
      this.#recordRevision(areaId, saved.id, "create", saved);
      const revision = this.#incrementGlobalRevision();
      return { beat: saved, revision };
    });
  }

  updateBeat(areaId, beatId, input, expectedVersion) {
    const existing = this.getBeat(areaId, beatId);
    if (!existing) throw new NotFoundError("Beat not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("This beat changed in another window.", existing);
    }
    const validation = validateBeat(input, this.world, this.character);
    if (!validation.valid) throw new ValidationError(validation.errors);
    if (validation.beat.id !== beatId) {
      throw new ValidationError({ id: ["Existing beat IDs cannot be renamed. Duplicate it instead."] });
    }
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.#replaceBeat(areaId, beatId, validation.beat, nextVersion, existing.createdAt);
      const saved = this.getBeat(areaId, beatId);
      this.#recordRevision(areaId, beatId, "update", saved);
      const revision = this.#incrementGlobalRevision();
      return { beat: saved, revision };
    });
  }

  deleteBeat(areaId, beatId, expectedVersion) {
    const existing = this.getBeat(areaId, beatId);
    if (!existing) throw new NotFoundError("Beat not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("This beat changed in another window.", existing);
    }
    return transaction(this.db, () => {
      this.#recordRevision(areaId, beatId, "delete", existing);
      this.db.prepare("DELETE FROM story_beats WHERE area_id = ? AND id = ?").run(areaId, beatId);
      const revision = this.#incrementGlobalRevision();
      return { deleted: true, revision };
    });
  }

  listRevisions(areaId, beatId) {
    return this.db.prepare(`
      SELECT revision, operation, created_at AS createdAt
      FROM story_revisions
      WHERE area_id = ? AND beat_id = ?
      ORDER BY revision DESC
    `).all(areaId, beatId);
  }

  restoreRevision(areaId, beatId, revisionNumber) {
    const row = this.db.prepare(`
      SELECT snapshot_json
      FROM story_revisions
      WHERE area_id = ? AND beat_id = ? AND revision = ?
    `).get(areaId, beatId, Number(revisionNumber));
    if (!row) throw new NotFoundError("Revision not found.");
    const snapshot = normalizeBeat(JSON.parse(row.snapshot_json));
    const validation = validateBeat(snapshot, this.world, this.character);
    if (!validation.valid) throw new ValidationError(validation.errors);

    return transaction(this.db, () => {
      this.#ensureArea(areaId);
      const existing = this.getBeat(areaId, beatId);
      const nextVersion = (existing?.version ?? 0) + 1;
      if (existing) {
        this.#replaceBeat(areaId, beatId, validation.beat, nextVersion, existing.createdAt);
      } else {
        this.#insertBeat(areaId, validation.beat, nextVersion);
      }
      const saved = this.getBeat(areaId, beatId);
      this.#recordRevision(areaId, beatId, "restore", saved);
      const revision = this.#incrementGlobalRevision();
      return { beat: saved, revision };
    });
  }

  importArea(data, { replace = false } = {}) {
    const areaId = String(data.area ?? "").trim();
    if (!areaId) throw new ValidationError({ area: ["Area ID is required."] });
    const entries = Object.entries(data.beats ?? {});
    const normalized = entries.map(([id, beat]) =>
      validateBeat({ ...beat, id }, this.world, this.character));
    const errors = Object.fromEntries(
      normalized.flatMap((result, index) =>
        Object.entries(result.errors).map(([path, messages]) => [`beats.${entries[index][0]}.${path}`, messages]),
      ),
    );
    if (Object.keys(errors).length) throw new ValidationError(errors);

    transaction(this.db, () => {
      const existing = this.db.prepare("SELECT 1 AS found FROM story_areas WHERE id = ?").get(areaId);
      if (existing && !replace) {
        throw new ConflictError(`Area "${areaId}" already exists. Use --replace to overwrite it.`);
      }
      if (existing) {
        this.db.prepare("DELETE FROM story_revisions WHERE area_id = ?").run(areaId);
        this.db.prepare("DELETE FROM story_areas WHERE id = ?").run(areaId);
      }
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO story_areas(id, name, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(areaId, data.name ?? areaId, this.listAreas().length, now, now);
      normalized.forEach((result) => {
        this.#insertBeat(areaId, result.beat, 1);
        this.#recordRevision(areaId, result.beat.id, "create", this.getBeat(areaId, result.beat.id));
      });
      this.#incrementGlobalRevision();
    });
    return this.getRuntimeStory();
  }

  validateAgainstWorld(world, renames = []) {
    const renameMap = new Map(
      renames
        .filter((rename) => rename?.kind === "hex" && rename.from && rename.to)
        .map((rename) => [String(rename.from), String(rename.to)]),
    );
    const rename = (value) => resolveRename(renameMap, value);
    const roomRenameMap = renameMapFor(renames, "room");
    const exteriorRenameMap = renameMapFor(renames, "exteriorNode");
    const errors = {};
    for (const area of this.listAreas()) {
      for (const original of this.listBeats(area.id, { full: true })) {
        const beat = structuredClone(original);
        if (beat.trigger.hex) beat.trigger.hex = rename(beat.trigger.hex);
        if (beat.trigger.room) beat.trigger.room = resolveRename(roomRenameMap, beat.trigger.room);
        if (beat.trigger.exteriorNode) {
          beat.trigger.exteriorNode = resolveRename(exteriorRenameMap, beat.trigger.exteriorNode);
        }
        for (const choice of beat.choices) {
          if (choice.go_hex) choice.go_hex = rename(choice.go_hex);
          if (choice.go_room) choice.go_room = resolveRename(roomRenameMap, choice.go_room);
        }
        const validation = validateBeat(beat, world, this.character);
        for (const [path, messages] of Object.entries(validation.errors)) {
          errors[`story.${area.id}.${beat.id}.${path}`] = messages;
        }
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  validateAgainstCharacter(character) {
    const errors = {};
    for (const area of this.listAreas()) {
      for (const beat of this.listBeats(area.id, { full: true })) {
        const validation = validateBeat(beat, this.world, character);
        for (const [path, messages] of Object.entries(validation.errors)) {
          if (
            path === "trigger.hex" ||
            path === "trigger.room" ||
            path === "trigger.exteriorNode" ||
            path.endsWith(".go_hex") ||
            path.endsWith(".go_room") ||
            path.endsWith(".enter")
          ) continue;
          errors[`story.${area.id}.${beat.id}.${path}`] = messages;
        }
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  findCharacterReferences(domain, id) {
    void domain;
    void id;
    return [];
  }

  findHexReferences(hexId) {
    const references = [];
    for (const area of this.listAreas()) {
      for (const beat of this.listBeats(area.id, { full: true })) {
        if (beat.trigger.hex === hexId) {
          references.push({
            kind: "story",
            areaId: area.id,
            beatId: beat.id,
            path: "trigger.hex",
          });
        }
        beat.choices.forEach((choice, index) => {
          if (choice.go_hex === hexId) {
            references.push({
              kind: "story",
              areaId: area.id,
              beatId: beat.id,
              path: `choices.${index}.go_hex`,
            });
          }
        });
      }
    }
    return references;
  }

  findBuildingReferences(kind, id) {
    const references = [];
    for (const area of this.listAreas()) {
      for (const beat of this.listBeats(area.id, { full: true })) {
        if (kind === "room" && beat.trigger.room === id) {
          references.push({ kind: "story", areaId: area.id, beatId: beat.id, path: "trigger.room" });
        }
        if (kind === "exteriorNode" && beat.trigger.exteriorNode === id) {
          references.push({
            kind: "story",
            areaId: area.id,
            beatId: beat.id,
            path: "trigger.exteriorNode",
          });
        }
        if (kind === "room") {
          beat.choices.forEach((choice, index) => {
            if (choice.go_room === id) {
              references.push({
                kind: "story",
                areaId: area.id,
                beatId: beat.id,
                path: `choices.${index}.go_room`,
              });
            }
          });
        }
      }
    }
    return references;
  }

  cascadeHexRenames(renames = [], world = this.world) {
    const renameMap = new Map(
      renames
        .filter((rename) => rename?.kind === "hex" && rename.from && rename.to)
        .map((rename) => [String(rename.from), String(rename.to)]),
    );
    if (!renameMap.size) {
      this.world = world;
      return { affected: [], revision: this.getGlobalRevision() };
    }
    const affected = [];
    const rename = (value) => resolveRename(renameMap, value);
    for (const area of this.listAreas()) {
      for (const original of this.listBeats(area.id, { full: true })) {
        const beat = structuredClone(original);
        let changed = false;
        if (beat.trigger.hex && renameMap.has(beat.trigger.hex)) {
          beat.trigger.hex = rename(beat.trigger.hex);
          changed = true;
        }
        for (const choice of beat.choices) {
          if (choice.go_hex && renameMap.has(choice.go_hex)) {
            choice.go_hex = rename(choice.go_hex);
            changed = true;
          }
        }
        if (!changed) continue;
        const validation = validateBeat(beat, world, this.character);
        if (!validation.valid) throw new ValidationError(validation.errors);
        this.#replaceBeat(area.id, original.id, validation.beat, original.version + 1, original.createdAt);
        const saved = this.getBeat(area.id, original.id);
        this.#recordRevision(area.id, original.id, "update", saved);
        affected.push({ areaId: area.id, beatId: original.id });
      }
    }
    this.world = world;
    const revision = affected.length ? this.#incrementGlobalRevision() : this.getGlobalRevision();
    return { affected, revision };
  }

  cascadeBuildingRenames(renames = [], world = this.world) {
    const roomMap = renameMapFor(renames, "room");
    const exteriorMap = renameMapFor(renames, "exteriorNode");
    if (!roomMap.size && !exteriorMap.size) {
      this.world = world;
      return { affected: [], revision: this.getGlobalRevision() };
    }
    const affected = [];
    for (const area of this.listAreas()) {
      for (const original of this.listBeats(area.id, { full: true })) {
        const beat = structuredClone(original);
        let changed = false;
        if (beat.trigger.room && roomMap.has(beat.trigger.room)) {
          beat.trigger.room = resolveRename(roomMap, beat.trigger.room);
          changed = true;
        }
        if (beat.trigger.exteriorNode && exteriorMap.has(beat.trigger.exteriorNode)) {
          beat.trigger.exteriorNode = resolveRename(exteriorMap, beat.trigger.exteriorNode);
          changed = true;
        }
        for (const choice of beat.choices) {
          if (choice.go_room && roomMap.has(choice.go_room)) {
            choice.go_room = resolveRename(roomMap, choice.go_room);
            changed = true;
          }
        }
        if (!changed) continue;
        const validation = validateBeat(beat, world, this.character);
        if (!validation.valid) throw new ValidationError(validation.errors);
        this.#replaceBeat(area.id, original.id, validation.beat, original.version + 1, original.createdAt);
        const saved = this.getBeat(area.id, original.id);
        this.#recordRevision(area.id, original.id, "update", saved);
        affected.push({ areaId: area.id, beatId: original.id });
      }
    }
    this.world = world;
    const revision = affected.length ? this.#incrementGlobalRevision() : this.getGlobalRevision();
    return { affected, revision };
  }

  #ensureArea(areaId) {
    const existing = this.db.prepare("SELECT 1 AS found FROM story_areas WHERE id = ?").get(areaId);
    if (existing) return;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO story_areas(id, name, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(areaId, areaId, this.listAreas().length, now, now);
  }

  #insertBeat(areaId, beat, version, createdAt = new Date().toISOString()) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO story_beats(
        area_id, id, sort_order, trigger_place, trigger_hex, trigger_room,
        trigger_exterior_node, trigger_event, trigger_flag, once_value, acknowledge,
        eyebrow, heading, text, revisit, require_all, require_any, require_not, require_json,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      areaId, beat.id, 0, beat.trigger.place, beat.trigger.hex, beat.trigger.room,
      beat.trigger.exteriorNode, beat.trigger.event, beat.trigger.flag,
      Number(beat.once), 1, beat.eyebrow, beat.heading,
      beat.text, beat.revisit,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({}), version, createdAt, now,
    );
    this.#insertChoices(areaId, beat.id, beat.choices);
  }

  #replaceBeat(areaId, beatId, beat, version, createdAt) {
    this.db.prepare("DELETE FROM story_choices WHERE area_id = ? AND beat_id = ?").run(areaId, beatId);
    this.db.prepare("DELETE FROM story_beats WHERE area_id = ? AND id = ?").run(areaId, beatId);
    this.#insertBeat(areaId, beat, version, createdAt);
  }

  #insertChoices(areaId, beatId, choices) {
    const statement = this.db.prepare(`
      INSERT INTO story_choices(
        id, area_id, beat_id, sort_order, text, require_json, effects_json,
        time_minutes, activity,
        sets_json, set_flags_json, go_hex, go_room, enter_building, view_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    choices.forEach((choice, index) => statement.run(
      choice.id || randomUUID(), areaId, beatId, choice.order ?? index, choice.text,
      JSON.stringify({}), JSON.stringify([]),
      choice.timeMinutes, choice.activity,
      JSON.stringify(choice.sets), JSON.stringify(choice.set_flags),
      choice.go_hex, choice.go_room, choice.enter, JSON.stringify(choice.view ?? {}),
    ));
  }

  #rowToBeat(row, includeChoices) {
    const beat = {
      areaId: row.area_id,
      id: row.id,
      once: Boolean(row.once_value),
      eyebrow: row.eyebrow,
      heading: row.heading,
      text: row.text,
      revisit: row.revisit,
      trigger: {
        place: row.trigger_place,
        hex: row.trigger_hex,
        room: row.trigger_room,
        exteriorNode: row.trigger_exterior_node,
        event: row.trigger_event,
        flag: row.trigger_flag,
      },
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (includeChoices) {
      beat.choices = this.db.prepare(`
        SELECT id, sort_order, text, require_json, effects_json, time_minutes, activity,
          sets_json, set_flags_json, go_hex, go_room, enter_building, view_json
        FROM story_choices
        WHERE area_id = ? AND beat_id = ?
        ORDER BY sort_order, id
      `).all(row.area_id, row.id).map((choice) => ({
        id: choice.id,
        order: choice.sort_order,
        text: choice.text,
        timeMinutes: choice.time_minutes,
        activity: choice.activity,
        sets: JSON.parse(choice.sets_json),
        set_flags: JSON.parse(choice.set_flags_json),
        go_hex: choice.go_hex,
        go_room: choice.go_room,
        enter: choice.enter_building,
        view: parseNullableJson(choice.view_json),
      }));
    }
    return beat;
  }

  #recordRevision(areaId, beatId, operation, snapshot) {
    const revision = Number(this.db.prepare(`
      SELECT COALESCE(MAX(revision), 0) + 1 AS next
      FROM story_revisions
      WHERE area_id = ? AND beat_id = ?
    `).get(areaId, beatId).next);
    this.db.prepare(`
      INSERT INTO story_revisions(area_id, beat_id, revision, operation, snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(areaId, beatId, revision, operation, JSON.stringify(snapshot), new Date().toISOString());
  }

  #incrementGlobalRevision() {
    const next = this.getGlobalRevision() + 1;
    this.db.prepare("UPDATE content_meta SET value = ? WHERE key = 'story_revision'").run(String(next));
    return next;
  }
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

function renameMapFor(renames, kind) {
  return new Map(
    renames
      .filter((rename) => rename?.kind === kind && rename.from && rename.to)
      .map((rename) => [String(rename.from), String(rename.to)]),
  );
}

function parseNullableJson(value) {
  const parsed = JSON.parse(value || "{}");
  return parsed && Object.keys(parsed).length ? parsed : null;
}

export class ValidationError extends Error {
  constructor(errors) {
    super("Validation failed.");
    this.status = 422;
    this.errors = errors;
  }
}

export class ConflictError extends Error {
  constructor(message, current = null) {
    super(message);
    this.status = 409;
    this.current = current;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}
