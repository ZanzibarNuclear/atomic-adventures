import { randomUUID } from "node:crypto";
import { transaction } from "./db.js";
import { beatToRuntime, normalizeBeat, validateBeat } from "./story-model.js";
import { RevisionStore } from "./revision-store.js";

const MILESTONE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MILESTONE_KINDS = new Set([
  "story",
  "discovery",
  "knowledge",
  "application",
  "operations",
  "survival",
  "world",
]);

export class StoryRepository {
  constructor(db, world, character = null, learning = null) {
    this.db = db;
    this.world = world;
    this.character = character;
    this.learning = learning;
    this.revisions = new RevisionStore(db, {
      table: "story_revisions",
      idColumns: ["area_id", "beat_id"],
      metaKey: "story_revision",
    });
  }

  setWorld(world) {
    this.world = world;
  }

  setCharacter(character) {
    this.character = character;
  }

  setLearning(learning) {
    this.learning = learning;
  }

  getGlobalRevision() {
    return this.revisions.getGlobalRevision();
  }

  getRuntimeStory() {
    const areas = this.db.prepare(
      "SELECT id, name, milestones_json FROM story_areas ORDER BY sort_order, id",
    ).all();
    const result = {};
    for (const area of areas) {
      result[area.id] = {
        area: area.id,
        name: area.name,
        milestones: normalizeMilestones(JSON.parse(area.milestones_json || "[]")),
        beats: Object.fromEntries(
          this.listBeats(area.id, { full: true }).map((beat) => [beat.id, beatToRuntime(beat)]),
        ),
      };
    }
    return { revision: this.getGlobalRevision(), areas: result };
  }

  listAreas() {
    return this.db.prepare(`
      SELECT id, name, sort_order AS sortOrder, milestones_json
      FROM story_areas
      ORDER BY sort_order, id
    `).all().map((area) => ({
      id: area.id,
      name: area.name,
      sortOrder: area.sortOrder,
      milestones: normalizeMilestones(JSON.parse(area.milestones_json || "[]")),
    }));
  }

  listMilestones(areaId) {
    const row = this.db.prepare(
      "SELECT milestones_json FROM story_areas WHERE id = ?",
    ).get(areaId);
    return normalizeMilestones(JSON.parse(row?.milestones_json || "[]"));
  }

  saveMilestones(areaId, input = []) {
    const validation = validateMilestones(input);
    if (!validation.valid) throw new ValidationError(validation.errors);
    return transaction(this.db, () => {
      this.#ensureArea(areaId);
      const now = new Date().toISOString();
      this.db.prepare(`
        UPDATE story_areas
        SET milestones_json = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(validation.milestones), now, areaId);
      const revision = this.revisions.incrementGlobalRevision();
      return { milestones: validation.milestones, revision };
    });
  }

  listBeats(areaId, { full = false } = {}) {
    const rows = this.db.prepare(`
      SELECT area_id, id, sort_order, trigger_place, trigger_hex, trigger_room,
        trigger_stand, trigger_exterior_node, trigger_event, trigger_flag, once_value, acknowledge,
        eyebrow, heading, text, revisit, require_all, require_any, require_not, require_json,
        modes_json, story_beat, match_json, time_json,
        version, created_at, updated_at
      FROM story_beats
      WHERE area_id = ?
      ORDER BY sort_order, id
    `).all(areaId);
    return rows.map((row) => {
      const beat = this.#rowToBeat(row, full);
      if (!full) {
        delete beat.choices;
        beat.definedFlags = this.#choiceFlagIds(row.area_id, row.id);
      }
      return beat;
    });
  }

  getBeat(areaId, beatId) {
    const row = this.db.prepare(`
      SELECT area_id, id, sort_order, trigger_place, trigger_hex, trigger_room,
        trigger_stand, trigger_exterior_node, trigger_event, trigger_flag, once_value, acknowledge,
        eyebrow, heading, text, revisit, require_all, require_any, require_not, require_json,
        modes_json, story_beat, match_json, time_json,
        version, created_at, updated_at
      FROM story_beats
      WHERE area_id = ? AND id = ?
    `).get(areaId, beatId);
    return row ? this.#rowToBeat(row, true) : null;
  }

  createBeat(areaId, input) {
    const validation = validateBeat(input, this.world, this.character, this.learning);
    if (!validation.valid) throw new ValidationError(validation.errors);
    if (this.getBeat(areaId, validation.beat.id)) {
      throw new ValidationError({ id: ["That beat ID already exists in this area."] });
    }
    return transaction(this.db, () => {
      this.#ensureArea(areaId);
      this.#insertBeat(areaId, validation.beat, 1);
      const saved = this.getBeat(areaId, validation.beat.id);
      this.revisions.record([areaId, saved.id], "create", saved);
      const revision = this.revisions.incrementGlobalRevision();
      return { beat: saved, revision };
    });
  }

  updateBeat(areaId, beatId, input, expectedVersion) {
    const existing = this.getBeat(areaId, beatId);
    if (!existing) throw new NotFoundError("Beat not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("This beat changed in another window.", existing);
    }
    const validation = validateBeat(input, this.world, this.character, this.learning);
    if (!validation.valid) throw new ValidationError(validation.errors);
    const nextBeatId = validation.beat.id;
    const renamedFrom = nextBeatId === beatId ? null : beatId;
    if (renamedFrom) {
      if (this.getBeat(areaId, nextBeatId)) {
        throw new ValidationError({ id: ["That beat ID already exists in this area."] });
      }
      const existingHistory = this.db.prepare(`
        SELECT 1 AS found
        FROM story_revisions
        WHERE area_id = ? AND beat_id = ?
        LIMIT 1
      `).get(areaId, nextBeatId);
      if (existingHistory) {
        throw new ValidationError({ id: ["That beat ID already has revision history in this area."] });
      }
    }
    return transaction(this.db, () => {
      const nextVersion = existing.version + 1;
      this.#replaceBeat(areaId, beatId, validation.beat, nextVersion, existing.createdAt);
      if (renamedFrom) this.#renameRevisionHistory(areaId, renamedFrom, nextBeatId);
      const saved = this.getBeat(areaId, nextBeatId);
      this.revisions.record([areaId, nextBeatId], "update", saved);
      const revision = this.revisions.incrementGlobalRevision();
      return { beat: saved, revision, renamedFrom };
    });
  }

  deleteBeat(areaId, beatId, expectedVersion) {
    const existing = this.getBeat(areaId, beatId);
    if (!existing) throw new NotFoundError("Beat not found.");
    if (Number(expectedVersion) !== existing.version) {
      throw new ConflictError("This beat changed in another window.", existing);
    }
    return transaction(this.db, () => {
      this.revisions.record([areaId, beatId], "delete", existing);
      this.db.prepare("DELETE FROM story_beats WHERE area_id = ? AND id = ?").run(areaId, beatId);
      const revision = this.revisions.incrementGlobalRevision();
      return { deleted: true, revision };
    });
  }

  reorderBeats(areaId, beatIds = []) {
    const ids = Array.isArray(beatIds) ? beatIds.map(String).filter(Boolean) : [];
    if (!ids.length) return { revision: this.getGlobalRevision(), beatIds: [] };
    return transaction(this.db, () => {
      const existing = new Set(this.listBeats(areaId).map((beat) => beat.id));
      const missing = ids.filter((id) => !existing.has(id));
      if (missing.length) {
        throw new ValidationError({ beatIds: [`Unknown beat IDs: ${missing.join(", ")}`] });
      }
      const update = this.db.prepare(`
        UPDATE story_beats
        SET sort_order = ?, updated_at = ?
        WHERE area_id = ? AND id = ?
      `);
      const now = new Date().toISOString();
      ids.forEach((id, index) => update.run(index, now, areaId, id));
      const revision = this.revisions.incrementGlobalRevision();
      return { revision, beatIds: ids };
    });
  }

  listRevisions(areaId, beatId) {
    return this.revisions.list([areaId, beatId]);
  }

  restoreRevision(areaId, beatId, revisionNumber) {
    const row = this.revisions.getSnapshot([areaId, beatId], revisionNumber);
    if (!row) throw new NotFoundError("Revision not found.");
    const snapshot = normalizeBeat({ ...row, id: beatId });
    const validation = validateBeat(snapshot, this.world, this.character, this.learning);
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
      this.revisions.record([areaId, beatId], "restore", saved);
      const revision = this.revisions.incrementGlobalRevision();
      return { beat: saved, revision };
    });
  }

  importArea(data, { replace = false } = {}) {
    const areaId = String(data.area ?? "").trim();
    if (!areaId) throw new ValidationError({ area: ["Area ID is required."] });
    const entries = Object.entries(data.beats ?? {});
    const normalized = entries.map(([id, beat]) =>
      validateBeat({ ...beat, id }, this.world, this.character, this.learning));
    const errors = Object.fromEntries(
      normalized.flatMap((result, index) =>
        Object.entries(result.errors).map(([path, messages]) => [`beats.${entries[index][0]}.${path}`, messages]),
      ),
    );
    const milestoneValidation = validateMilestones(data.milestones ?? []);
    for (const [path, messages] of Object.entries(milestoneValidation.errors)) {
      errors[`milestones.${path}`] = messages;
    }
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
        INSERT INTO story_areas(id, name, sort_order, created_at, updated_at, milestones_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        areaId,
        data.name ?? areaId,
        this.listAreas().length,
        now,
        now,
        JSON.stringify(milestoneValidation.milestones),
      );
      normalized.forEach((result) => {
        this.#insertBeat(areaId, result.beat, 1);
        this.revisions.record([areaId, result.beat.id], "create", this.getBeat(areaId, result.beat.id));
      });
      this.revisions.incrementGlobalRevision();
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
        if (beat.match?.originHex) beat.match.originHex = mapOriginHexes(beat.match.originHex, rename);
        if (beat.trigger.room) beat.trigger.room = resolveRename(roomRenameMap, beat.trigger.room);
        if (beat.trigger.exteriorNode) {
          beat.trigger.exteriorNode = resolveRename(exteriorRenameMap, beat.trigger.exteriorNode);
        }
        for (const choice of beat.choices) {
          if (choice.go_hex) choice.go_hex = rename(choice.go_hex);
          if (choice.go_room) choice.go_room = resolveRename(roomRenameMap, choice.go_room);
          if (choice.go_exterior_node) {
            choice.go_exterior_node = resolveRename(exteriorRenameMap, choice.go_exterior_node);
          }
        }
        const validation = validateBeat(beat, world, this.character, this.learning);
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
        const validation = validateBeat(beat, this.world, character, this.learning);
        for (const [path, messages] of Object.entries(validation.errors)) {
          if (
            path === "trigger.hex" ||
            path === "trigger.room" ||
            path === "trigger.exteriorNode" ||
            path.endsWith(".go_hex") ||
            path.endsWith(".go_room") ||
            path.endsWith(".go_exterior_node") ||
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

  findLearningReferences(lessonId) {
    const references = [];
    for (const area of this.listAreas()) {
      for (const beat of this.listBeats(area.id, { full: true })) {
        beat.choices.forEach((choice, index) => {
          if (choice.view?.kind === "lesson" && choice.view.id === lessonId) {
            references.push({
              kind: "story",
              areaId: area.id,
              beatId: beat.id,
              path: `choices.${index}.view.id`,
            });
          }
        });
      }
    }
    return references;
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
        if (originHexList(beat.match?.originHex).includes(hexId)) {
          references.push({
            kind: "story",
            areaId: area.id,
            beatId: beat.id,
            path: "match.originHex",
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
        if (kind === "exteriorNode") {
          beat.choices.forEach((choice, index) => {
            if (choice.go_exterior_node === id) {
              references.push({
                kind: "story",
                areaId: area.id,
                beatId: beat.id,
                path: `choices.${index}.go_exterior_node`,
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
        if (originHexList(beat.match?.originHex).some((originHex) => renameMap.has(originHex))) {
          beat.match.originHex = mapOriginHexes(beat.match.originHex, rename);
          changed = true;
        }
        for (const choice of beat.choices) {
          if (choice.go_hex && renameMap.has(choice.go_hex)) {
            choice.go_hex = rename(choice.go_hex);
            changed = true;
          }
        }
        if (!changed) continue;
        const validation = validateBeat(beat, world, this.character, this.learning);
        if (!validation.valid) throw new ValidationError(validation.errors);
        this.#replaceBeat(area.id, original.id, validation.beat, original.version + 1, original.createdAt);
        const saved = this.getBeat(area.id, original.id);
        this.revisions.record([area.id, original.id], "update", saved);
        affected.push({ areaId: area.id, beatId: original.id });
      }
    }
    this.world = world;
    const revision = affected.length ? this.revisions.incrementGlobalRevision() : this.getGlobalRevision();
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
          if (choice.go_exterior_node && exteriorMap.has(choice.go_exterior_node)) {
            choice.go_exterior_node = resolveRename(exteriorMap, choice.go_exterior_node);
            changed = true;
          }
        }
        if (!changed) continue;
        const validation = validateBeat(beat, world, this.character, this.learning);
        if (!validation.valid) throw new ValidationError(validation.errors);
        this.#replaceBeat(area.id, original.id, validation.beat, original.version + 1, original.createdAt);
        const saved = this.getBeat(area.id, original.id);
        this.revisions.record([area.id, original.id], "update", saved);
        affected.push({ areaId: area.id, beatId: original.id });
      }
    }
    this.world = world;
    const revision = affected.length ? this.revisions.incrementGlobalRevision() : this.getGlobalRevision();
    return { affected, revision };
  }

  #ensureArea(areaId) {
    const existing = this.db.prepare("SELECT 1 AS found FROM story_areas WHERE id = ?").get(areaId);
    if (existing) return;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO story_areas(id, name, sort_order, created_at, updated_at, milestones_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(areaId, areaId, this.listAreas().length, now, now, JSON.stringify([]));
  }

  #insertBeat(areaId, beat, version, createdAt = new Date().toISOString()) {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO story_beats(
        area_id, id, sort_order, trigger_place, trigger_hex, trigger_room,
        trigger_stand, trigger_exterior_node, trigger_event, trigger_flag, once_value, acknowledge,
        eyebrow, heading, text, revisit, require_all, require_any, require_not, require_json,
        modes_json, story_beat, match_json, time_json,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      areaId, beat.id, Number.isFinite(Number(beat.sortOrder)) ? Number(beat.sortOrder) : 0, beat.trigger.place, beat.trigger.hex, beat.trigger.room,
      beat.trigger.stand, beat.trigger.exteriorNode, beat.trigger.event, beat.trigger.flag,
      Number(beat.once), 1, beat.eyebrow, beat.heading,
      beat.text, beat.revisit,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify(beat.conditions ?? {}),
      JSON.stringify(beat.modes ?? []),
      beat.storyBeat,
      JSON.stringify(compactObject(beat.match ?? {})),
      JSON.stringify(compactObject(beat.time ?? {})),
      version, createdAt, now,
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
        time_minutes, time_until_json, activity,
        set_flags_json, go_hex, go_room, go_exterior_node,
        enter_building, view_json, grant_milestones_json, open_passage, close_passage, cross_passage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    choices.forEach((choice, index) => statement.run(
      choice.id || randomUUID(), areaId, beatId, choice.order ?? index, choice.text,
      JSON.stringify({}), JSON.stringify(choice.effects ?? []),
      choice.timeMinutes, JSON.stringify(compactObject(choice.timeUntil ?? {})), choice.activity,
      JSON.stringify(choice.set_flags),
      choice.go_hex, choice.go_room, choice.go_exterior_node,
      choice.enter, JSON.stringify(choice.view ?? {}),
      JSON.stringify(choice.grantMilestones ?? []), choice.openPassage, choice.closePassage, choice.crossPassage,
    ));
  }

  #rowToBeat(row, includeChoices) {
    const beat = {
      areaId: row.area_id,
      id: row.id,
      sortOrder: row.sort_order,
      once: Boolean(row.once_value),
      eyebrow: row.eyebrow,
      heading: row.heading,
      text: row.text,
      revisit: row.revisit,
      modes: parseNullableJson(row.modes_json) ?? [],
      storyBeat: row.story_beat,
      trigger: {
        place: row.trigger_place,
        hex: row.trigger_hex,
        room: row.trigger_room,
        stand: row.trigger_stand,
        exteriorNode: row.trigger_exterior_node,
        event: row.trigger_event,
        flag: row.trigger_flag,
      },
      match: parseMatchJson(row.match_json),
      time: parseNullableJson(row.time_json) ?? {},
      conditions: parseNullableJson(row.require_json) ?? {},
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (includeChoices) {
      beat.choices = this.db.prepare(`
        SELECT id, sort_order, text, require_json, effects_json, time_minutes, time_until_json, activity,
          set_flags_json, go_hex, go_room, go_exterior_node,
          enter_building, view_json, grant_milestones_json, open_passage, close_passage, cross_passage
        FROM story_choices
        WHERE area_id = ? AND beat_id = ?
        ORDER BY sort_order, id
      `).all(row.area_id, row.id).map((choice) => ({
        id: choice.id,
        order: choice.sort_order,
        text: choice.text,
        timeMinutes: choice.time_minutes,
        timeUntil: parseNullableJson(choice.time_until_json),
        activity: choice.activity,
        set_flags: JSON.parse(choice.set_flags_json),
        effects: JSON.parse(choice.effects_json),
        grantMilestones: JSON.parse(choice.grant_milestones_json),
        openPassage: choice.open_passage,
        closePassage: choice.close_passage,
        crossPassage: choice.cross_passage,
        go_hex: choice.go_hex,
        go_room: choice.go_room,
        go_exterior_node: choice.go_exterior_node,
        enter: choice.enter_building,
        view: parseNullableJson(choice.view_json),
      }));
    }
    return beat;
  }

  #choiceFlagIds(areaId, beatId) {
    const flags = new Set();
    const rows = this.db.prepare(`
      SELECT set_flags_json, effects_json
      FROM story_choices
      WHERE area_id = ? AND beat_id = ?
    `).all(areaId, beatId);
    for (const row of rows) {
      for (const flag of parseNullableJson(row.set_flags_json) ?? []) {
        if (typeof flag === "string" && flag) flags.add(flag);
      }
      for (const effect of parseNullableJson(row.effects_json) ?? []) {
        if (["flag.set", "flag.clear"].includes(effect?.op) && effect.id) {
          flags.add(effect.id);
        }
      }
    }
    return [...flags].sort((a, b) => a.localeCompare(b));
  }

  #renameRevisionHistory(areaId, fromBeatId, toBeatId) {
    this.db.prepare(`
      UPDATE story_revisions
      SET beat_id = ?
      WHERE area_id = ? AND beat_id = ?
    `).run(toBeatId, areaId, fromBeatId);
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

function parseMatchJson(value) {
  const parsed = JSON.parse(value || "{}");
  const mapTransition = nullableText(parsed.mapTransition);
  return {
    originHex: originHexValue(parsed.originHex),
    mapTransition,
    transitionDirection: nullableText(parsed.transitionDirection),
  };
}

function originHexList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function originHexValue(value) {
  const origins = originHexList(value);
  if (!origins.length) return null;
  return origins.length === 1 ? origins[0] : origins;
}

function mapOriginHexes(value, mapper) {
  const origins = originHexList(value).map(mapper);
  return origins.length === 1 ? origins[0] : origins;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  );
}

function nullableText(value) {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

function normalizeMilestones(value = []) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: nullableText(item?.id) ?? "",
    label: nullableText(item?.label) ?? nullableText(item?.id) ?? "",
    kind: nullableText(item?.kind) ?? "story",
    description: nullableText(item?.description),
  }));
}

function validateMilestones(input = []) {
  const milestones = normalizeMilestones(input);
  const errors = {};
  const add = (path, message) => {
    (errors[path] ??= []).push(message);
  };
  const seen = new Set();
  milestones.forEach((milestone, index) => {
    const base = `${index}`;
    if (!MILESTONE_ID_PATTERN.test(milestone.id)) {
      add(`${base}.id`, "Use lowercase letters, numbers, dots, and hyphens.");
    }
    if (seen.has(milestone.id)) add(`${base}.id`, "Milestone IDs must be unique.");
    seen.add(milestone.id);
    if (!milestone.label.trim()) add(`${base}.label`, "Milestone label is required.");
    if (!MILESTONE_KINDS.has(milestone.kind)) add(`${base}.kind`, "Choose a supported milestone kind.");
  });
  return { milestones, errors, valid: Object.keys(errors).length === 0 };
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
