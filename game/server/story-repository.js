import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
import { beatToRuntime, normalizeBeat, validateBeat } from "./story-model.js";

export class StoryRepository {
  constructor(db, world) {
    this.db = db;
    this.world = world;
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
        eyebrow, heading, text, revisit, require_all, require_any, require_not,
        version, created_at, updated_at
      FROM story_beats
      WHERE area_id = ?
      ORDER BY sort_order, id
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
        eyebrow, heading, text, revisit, require_all, require_any, require_not,
        version, created_at, updated_at
      FROM story_beats
      WHERE area_id = ? AND id = ?
    `).get(areaId, beatId);
    return row ? this.#rowToBeat(row, true) : null;
  }

  createBeat(areaId, input) {
    const validation = validateBeat(input, this.world);
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
    const validation = validateBeat(input, this.world);
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
    const validation = validateBeat(snapshot, this.world);
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
    const normalized = entries.map(([id, beat], order) => validateBeat({ ...beat, id, order }, this.world));
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
        eyebrow, heading, text, revisit, require_all, require_any, require_not,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      areaId, beat.id, beat.order, beat.trigger.place, beat.trigger.hex, beat.trigger.room,
      beat.trigger.exteriorNode, beat.trigger.event, beat.trigger.flag,
      Number(beat.once), Number(beat.acknowledge), beat.eyebrow, beat.heading,
      beat.text, beat.revisit, JSON.stringify(beat.require.all), JSON.stringify(beat.require.any),
      JSON.stringify(beat.require.not), version, createdAt, now,
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
        id, area_id, beat_id, sort_order, text, sets_json, set_flags_json,
        go_hex, go_room, enter_building
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    choices.forEach((choice, index) => statement.run(
      choice.id || randomUUID(), areaId, beatId, choice.order ?? index, choice.text,
      JSON.stringify(choice.sets), JSON.stringify(choice.set_flags),
      choice.go_hex, choice.go_room, choice.enter,
    ));
  }

  #rowToBeat(row, includeChoices) {
    const beat = {
      areaId: row.area_id,
      id: row.id,
      order: row.sort_order,
      once: Boolean(row.once_value),
      acknowledge: Boolean(row.acknowledge),
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
      require: {
        all: JSON.parse(row.require_all),
        any: JSON.parse(row.require_any),
        not: JSON.parse(row.require_not),
      },
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (includeChoices) {
      beat.choices = this.db.prepare(`
        SELECT id, sort_order, text, sets_json, set_flags_json, go_hex, go_room, enter_building
        FROM story_choices
        WHERE area_id = ? AND beat_id = ?
        ORDER BY sort_order, id
      `).all(row.area_id, row.id).map((choice) => ({
        id: choice.id,
        order: choice.sort_order,
        text: choice.text,
        sets: JSON.parse(choice.sets_json),
        set_flags: JSON.parse(choice.set_flags_json),
        go_hex: choice.go_hex,
        go_room: choice.go_room,
        enter: choice.enter_building,
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
