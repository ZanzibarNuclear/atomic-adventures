import { validateCharacterEffects } from "./character-reference-validation.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z0-9_]+(?:[.-][a-z0-9_]+)*$/;
const PLAY_MODES = new Set(["story", "open-world"]);
const MOVEMENT_MODES = new Set(["current-location-only", "local-area", "unrestricted"]);
const STAGE_VIEW_KINDS = new Set([
  "inventory",
  "character-stats",
  "character",
  "closeup",
  "lesson",
  "document",
  "console",
  "simulation",
]);
const ACTIVITIES = new Set(["resting", "light", "moderate", "strenuous"]);

export function normalizeStoryArcDocument(input = {}) {
  const source = input && typeof input === "object" ? structuredClone(input) : {};
  return {
    id: text(source.id) || "story-main",
    storyArcs: array(source.storyArcs).map((arc, arcIndex) => normalizeStoryArc(arc, arcIndex)),
  };
}

export function validateStoryArcDocument(input, {
  story = null,
  world = null,
  character = null,
  learning = null,
} = {}) {
  const storyArcDocument = normalizeStoryArcDocument(input);
  const errors = {};
  const add = (path, message) => ((errors[path] ??= []).push(message));

  if (storyArcDocument.id !== "story-main") add("id", 'Story arc document ID must be "story-main".');
  if (!storyArcDocument.storyArcs.length) add("storyArcs", "Add at least one story arc.");
  const arcIds = validateIds(storyArcDocument.storyArcs, "storyArcs", add);
  const arcsById = new Map(storyArcDocument.storyArcs.map((arc) => [arc.id, arc]));

  storyArcDocument.storyArcs.forEach((arc, arcIndex) => {
    const base = `storyArcs.${arcIndex}`;
    if (!arc.title) add(`${base}.title`, "Story arc title is required.");
    if (!PLAY_MODES.has(arc.defaultMode)) add(`${base}.defaultMode`, "Choose a supported default mode.");
    if (!arc.beats.length) add(`${base}.beats`, "Add at least one story beat.");
    const beatIds = validateIds(arc.beats, `${base}.beats`, add);
    if (!beatIds.has(arc.startBeat)) add(`${base}.startBeat`, "Choose an existing start beat.");
    validateArcCompletion(arc.completion, `${base}.completion`, add, { arcIds, arcId: arc.id, arcsById });

    arc.beats.forEach((beat, beatIndex) => {
      const beatBase = `${base}.beats.${beatIndex}`;
      if (!beat.title) add(`${beatBase}.title`, "Story beat title is required.");
      if (beat.scene && !storyBeatIds(story).has(beat.scene)) {
        add(`${beatBase}.scene`, "Choose an existing scene.");
      }
      if (beat.next && !beatIds.has(beat.next)) add(`${beatBase}.next`, "Choose an existing next beat.");
      validateAllowed(beat.allowed, `${beatBase}.allowed`, add, { world });
      validateCompletion(beat.completesWhen, `${beatBase}.completesWhen`, add, {
        world,
        character,
        learning,
      });
      validateBeatEffect(beat.onEnter, `${beatBase}.onEnter`, add, { world, character });
      validateBeatEffect(beat.onComplete, `${beatBase}.onComplete`, add, { world, character });
    });
  });

  return {
    storyArcDocument,
    errors,
    warnings: [],
    valid: Object.keys(errors).length === 0,
  };
}

function normalizeStoryArc(input = {}, index = 0) {
  return {
    id: text(input.id) || `story-arc-${index + 1}`,
    title: text(input.title),
    defaultMode: normalizePlayMode(text(input.defaultMode)) || "story",
    startBeat: text(input.startBeat),
    beats: array(input.beats).map((beat, beatIndex) => normalizeStoryBeat(beat, beatIndex)),
    completion: normalizeArcCompletion(input.completion),
  };
}

function normalizeArcCompletion(input = {}) {
  if (!input || typeof input !== "object") return null;
  const card = input.card && typeof input.card === "object"
    ? compactObject({
      eyebrow: nullableText(input.card.eyebrow),
      heading: nullableText(input.card.heading),
      description: nullableText(input.card.description),
      note: nullableText(input.card.note),
      actionLabel: nullableText(input.card.actionLabel),
    })
    : null;
  return compactObject({
    nextArc: nullableText(input.nextArc),
    nextBeat: nullableText(input.nextBeat),
    card,
  });
}

function normalizeStoryBeat(input = {}, index = 0) {
  return {
    id: text(input.id) || `story-beat-${index + 1}`,
    title: text(input.title),
    scene: nullableText(input.scene),
    choices: array(input.choices).map(normalizeStoryChoice),
    allowed: normalizeAllowed(input.allowed),
    completesWhen: normalizeCompletion(input.completesWhen),
    onEnter: normalizeBeatEffect(input.onEnter),
    onComplete: normalizeBeatEffect(input.onComplete),
    next: nullableText(input.next),
  };
}

function validateArcCompletion(completion, path, add, { arcIds, arcId, arcsById }) {
  if (!completion) return;
  if (completion.nextArc && !arcIds.has(completion.nextArc)) {
    add(`${path}.nextArc`, "Choose an existing next story arc.");
  }
  if (completion.nextArc === arcId) add(`${path}.nextArc`, "Choose a different next story arc.");
  if (completion.nextBeat) {
    if (!completion.nextArc) {
      add(`${path}.nextBeat`, "Set nextArc when choosing a merge beat.");
    } else {
      const nextArc = arcsById?.get(completion.nextArc);
      const beatIds = new Set((nextArc?.beats ?? []).map((beat) => beat.id));
      if (!beatIds.has(completion.nextBeat)) {
        add(`${path}.nextBeat`, "Choose a beat on the next story arc.");
      }
    }
  }
  if (!completion.card) return;
  for (const field of ["eyebrow", "heading", "description", "actionLabel"]) {
    if (!completion.card[field]) add(`${path}.card.${field}`, "This transition-card field is required.");
  }
}

function normalizeStoryChoice(input = {}) {
  if (!input || typeof input !== "object") return {};
  return compactObject({
    ...structuredClone(input),
    id: nullableText(input.id),
    label: nullableText(input.label),
    text: nullableText(input.text),
    go_hex: nullableText(input.go_hex),
    go_room: nullableText(input.go_room),
    go_exterior_node: nullableText(input.go_exterior_node),
    enter: nullableText(input.enter),
    nextBeat: nullableText(input.nextBeat),
    timeMinutes: nullableNumber(input.timeMinutes),
    activity: nullableText(input.activity),
    grantMilestones: stringList(input.grantMilestones),
    set_flags: stringList(input.set_flags),
    effects: array(input.effects).map((effect) => structuredClone(effect)),
    openPassage: nullableText(input.openPassage),
    closePassage: nullableText(input.closePassage),
    crossPassage: nullableText(input.crossPassage),
    view: normalizeStageView(input.view),
  });
}

function normalizeAllowed(input = {}) {
  return {
    movement: {
      mode: nullableText(input.movement?.mode),
      hexes: stringList(input.movement?.hexes),
      rooms: stringList(input.movement?.rooms),
      exteriorNodes: stringList(input.movement?.exteriorNodes),
      transitions: stringList(input.movement?.transitions),
    },
    storyForwardActions: stringList(input.storyForwardActions),
    optionalActions: stringList(input.optionalActions),
    storyChoices: stringList(input.storyChoices),
    stageViews: array(input.stageViews).map(normalizeStageView),
    indoorActions: stringList(input.indoorActions),
    outdoorActions: stringList(input.outdoorActions),
    itemActions: stringList(input.itemActions),
    developerActions: stringList(input.developerActions),
  };
}

function normalizeCompletion(input = {}) {
  if (!input || typeof input !== "object") return null;
  return compactObject({
    flag: nullableText(input.flag),
    facility: normalizeRecord(input.facility),
    location: normalizeLocation(input.location),
    holding: compactObject({
      item: nullableText(input.holding?.item),
      holder: nullableText(input.holding?.holder),
    }),
    lesson: compactObject({
      id: nullableText(input.lesson?.id),
      status: nullableText(input.lesson?.status),
    }),
    milestone: nullableText(input.milestone),
  });
}

function normalizeBeatEffect(input = {}) {
  if (!input || typeof input !== "object") return null;
  return compactObject({
    setFlags: stringList(input.setFlags),
    grantMilestones: stringList(input.grantMilestones),
    effects: array(input.effects).map((effect) => structuredClone(effect)),
    timeMinutes: nullableNumber(input.timeMinutes),
    activity: nullableText(input.activity),
    openPassage: nullableText(input.openPassage),
    closePassage: nullableText(input.closePassage),
    crossPassage: nullableText(input.crossPassage),
    move: normalizeLocation(input.move),
    view: normalizeStageView(input.view),
  });
}

function normalizeLocation(input = {}) {
  if (!input || typeof input !== "object") return null;
  return compactObject({
    place: nullableText(input.place),
    hex: normalizeLocationValue(input.hex),
    room: normalizeLocationValue(input.room),
    exteriorNode: normalizeLocationValue(input.exteriorNode),
  });
}

function normalizeLocationValue(value) {
  if (Array.isArray(value)) return stringList(value);
  return nullableText(value);
}

function normalizeStageView(input = {}) {
  if (!input || typeof input !== "object") return null;
  const kind = nullableText(input.kind);
  if (!kind) return null;
  return compactObject({
    kind,
    id: nullableText(input.id),
    focus: nullableText(input.focus),
    tab: nullableText(input.tab),
  });
}

function normalizeRecord(input = {}) {
  if (!input || typeof input !== "object") return null;
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [text(key), value])
      .filter(([key]) => key),
  );
}

function validateAllowed(allowed, path, add, { world }) {
  if (allowed.movement.mode && !MOVEMENT_MODES.has(allowed.movement.mode)) {
    add(`${path}.movement.mode`, "Choose a supported movement mode.");
  }
  validateWorldIds(allowed.movement.hexes, world?.hexIds, `${path}.movement.hexes`, add, "hex");
  validateWorldIds(allowed.movement.rooms, world?.roomIds, `${path}.movement.rooms`, add, "room");
  validateWorldIds(
    allowed.movement.exteriorNodes,
    world?.exteriorNodeIds,
    `${path}.movement.exteriorNodes`,
    add,
    "exterior node",
  );
  validateWorldIds(
    allowed.movement.transitions,
    world?.mapTransitionIds,
    `${path}.movement.transitions`,
    add,
    "map transition",
  );
  validateActionIds(allowed.storyForwardActions, `${path}.storyForwardActions`, add);
  validateActionIds(allowed.optionalActions, `${path}.optionalActions`, add);
  allowed.stageViews.forEach((view, index) => validateStageView(view, `${path}.stageViews.${index}`, add));
}

function validateCompletion(completion, path, add, { world, character, learning }) {
  if (!completion) return;
  const families = ["flag", "facility", "location", "holding", "lesson", "milestone"]
    .filter((key) => hasCompletionValue(completion[key]));
  if (families.length !== 1) add(path, "Choose exactly one completion condition.");
  if (completion.flag && !FLAG_PATTERN.test(completion.flag)) add(`${path}.flag`, "Use a valid flag ID.");
  if (completion.milestone && !FLAG_PATTERN.test(completion.milestone)) add(`${path}.milestone`, "Use a valid milestone ID.");
  if (completion.location) validateLocation(completion.location, `${path}.location`, add, { world });
  if (completion.holding) {
    if (!completion.holding.item) add(`${path}.holding.item`, "Choose an item.");
    else if (character && !catalogIds(character.items).has(completion.holding.item)) {
      add(`${path}.holding.item`, "Choose an existing item.");
    }
    if (!completion.holding.holder) add(`${path}.holding.holder`, "Choose a holder.");
  }
  if (completion.lesson) {
    if (!completion.lesson.id) add(`${path}.lesson.id`, "Choose a lesson.");
    else if (learning && !catalogIds(learning.lessons).has(completion.lesson.id)) {
      add(`${path}.lesson.id`, "Choose an existing lesson.");
    }
    if (completion.lesson.status !== "completed") add(`${path}.lesson.status`, "Choose a supported lesson status.");
  }
}

function validateBeatEffect(effect, path, add, { world, character }) {
  if (!effect) return;
  effect.setFlags?.forEach((flag, index) => {
    if (!FLAG_PATTERN.test(flag)) add(`${path}.setFlags.${index}`, "Use a valid flag ID.");
  });
  effect.grantMilestones?.forEach((milestone, index) => {
    if (!FLAG_PATTERN.test(milestone)) add(`${path}.grantMilestones.${index}`, "Use a valid milestone ID.");
  });
  if (effect.timeMinutes != null && effect.timeMinutes < 0) add(`${path}.timeMinutes`, "Time cannot be negative.");
  if (effect.activity && !ACTIVITIES.has(effect.activity)) add(`${path}.activity`, "Choose a supported activity.");
  if (effect.move) validateLocation(effect.move, `${path}.move`, add, { world });
  if (effect.view) validateStageView(effect.view, `${path}.view`, add);
  validateCharacterEffects(effect.effects ?? [], `${path}.effects`, character, add);
}

function validateLocation(location, path, add, { world }) {
  const destinations = [location.hex, location.room, location.exteriorNode].filter(Boolean);
  if (destinations.length > 1) add(path, "Choose at most one destination.");
  if (location.place && !["outdoors", "indoors"].includes(location.place)) {
    add(`${path}.place`, "Choose outdoors or indoors.");
  }
  if (location.hex) validateWorldIds(locationValues(location.hex), world?.hexIds, `${path}.hex`, add, "hex");
  if (location.room) validateWorldIds(locationValues(location.room), world?.roomIds, `${path}.room`, add, "room");
  if (location.exteriorNode) {
    validateWorldIds(locationValues(location.exteriorNode), world?.exteriorNodeIds, `${path}.exteriorNode`, add, "exterior node");
  }
}

function locationValues(value) {
  return Array.isArray(value) ? value : [value];
}

function validateStageView(view, path, add) {
  if (!view) return;
  if (!STAGE_VIEW_KINDS.has(view.kind)) add(`${path}.kind`, "Choose a supported stage view.");
}

function validateActionIds(ids, path, add) {
  ids.forEach((id, index) => {
    if (!id.includes(":")) {
      add(`${path}.${index}`, "Use a normalized action ID with a category prefix.");
    }
  });
}

function normalizePlayMode(mode) {
  return mode;
}

function validateWorldIds(ids, catalog, path, add, label) {
  if (!catalog) return;
  ids.forEach((id, index) => {
    if (!catalog.has(id)) add(Array.isArray(ids) && ids.length > 1 ? `${path}.${index}` : path, `Choose an existing ${label}.`);
  });
}

function storyBeatIds(story) {
  const ids = new Set();
  const areas = Array.isArray(story?.areas)
    ? story.areas
    : Object.values(story?.areas ?? {});
  for (const area of areas) {
    for (const beatId of Object.keys(area.beats ?? {})) ids.add(beatId);
  }
  return ids;
}

function hasCompletionValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value != null && value !== "";
}

function validateIds(entries, path, add) {
  const ids = new Set();
  entries.forEach((entry, index) => {
    if (!ID_PATTERN.test(entry.id)) add(`${path}.${index}.id`, "Use a kebab-case ID.");
    if (ids.has(entry.id)) add(`${path}.${index}.id`, "IDs must be unique.");
    ids.add(entry.id);
  });
  return ids;
}

function catalogIds(entries = []) {
  return new Set(entries.map((entry) => entry.id));
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(text).filter(Boolean);
  return [];
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function nullableText(value) {
  const valueText = text(value);
  return valueText || null;
}

function compactObject(value) {
  if (!value || typeof value !== "object") return null;
  const entries = Object.entries(value).filter(([, item]) => {
    if (item == null) return false;
    if (Array.isArray(item)) return item.length > 0;
    if (typeof item === "object") return Object.keys(item).length > 0;
    return true;
  });
  return entries.length ? Object.fromEntries(entries) : null;
}
