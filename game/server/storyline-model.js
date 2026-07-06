import { validateCharacterEffects } from "./character-reference-validation.js";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z0-9_]+(?:[.-][a-z0-9_]+)*$/;
const PLAY_MODES = new Set(["storyline", "open-world"]);
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

export function normalizeStorylineDocument(input = {}) {
  const source = input && typeof input === "object" ? structuredClone(input) : {};
  return {
    id: text(source.id) || "storyline-main",
    scenarios: array(source.scenarios).map((scenario, scenarioIndex) => normalizeScenario(scenario, scenarioIndex)),
  };
}

export function validateStorylineDocument(input, {
  story = null,
  world = null,
  character = null,
  learning = null,
} = {}) {
  const storyline = normalizeStorylineDocument(input);
  const errors = {};
  const add = (path, message) => ((errors[path] ??= []).push(message));

  if (storyline.id !== "storyline-main") add("id", 'Storyline document ID must be "storyline-main".');
  if (!storyline.scenarios.length) add("scenarios", "Add at least one storyline scenario.");
  const scenarioIds = validateIds(storyline.scenarios, "scenarios", add);

  storyline.scenarios.forEach((scenario, scenarioIndex) => {
    const base = `scenarios.${scenarioIndex}`;
    if (!scenario.label) add(`${base}.label`, "Scenario label is required.");
    if (!PLAY_MODES.has(scenario.defaultMode)) add(`${base}.defaultMode`, "Choose a supported default mode.");
    if (!scenario.steps.length) add(`${base}.steps`, "Add at least one step.");
    const stepIds = validateIds(scenario.steps, `${base}.steps`, add);
    if (!stepIds.has(scenario.startStep)) add(`${base}.startStep`, "Choose an existing start step.");

    scenario.steps.forEach((step, stepIndex) => {
      const stepBase = `${base}.steps.${stepIndex}`;
      if (!step.objective) add(`${stepBase}.objective`, "Objective text is required.");
      if (step.beat && !storyBeatIds(story).has(step.beat)) {
        add(`${stepBase}.beat`, "Choose an existing story beat.");
      }
      if (step.next && !stepIds.has(step.next)) add(`${stepBase}.next`, "Choose an existing next step.");
      if (step.next && step.nextScenario) add(`${stepBase}.next`, "Choose either a next step or next scenario, not both.");
      if (step.nextScenario && !scenarioIds.has(step.nextScenario)) {
        add(`${stepBase}.nextScenario`, "Choose an existing next scenario.");
      }
      validateAllowed(step.allowed, `${stepBase}.allowed`, add, { world });
      validateCompletion(step.completesWhen, `${stepBase}.completesWhen`, add, {
        world,
        character,
        learning,
      });
      validateStepEffect(step.onEnter, `${stepBase}.onEnter`, add, { world, character });
      validateStepEffect(step.onComplete, `${stepBase}.onComplete`, add, { world, character });
    });
  });

  return {
    storyline,
    errors,
    warnings: [],
    valid: Object.keys(errors).length === 0,
  };
}

function normalizeScenario(input = {}, index = 0) {
  return {
    id: text(input.id) || `scenario-${index + 1}`,
    label: text(input.label),
    defaultMode: text(input.defaultMode) || "storyline",
    startStep: text(input.startStep),
    steps: array(input.steps).map((step, stepIndex) => normalizeStep(step, stepIndex)),
  };
}

function normalizeStep(input = {}, index = 0) {
  return {
    id: text(input.id) || `step-${index + 1}`,
    objective: text(input.objective),
    beat: nullableText(input.beat),
    allowed: normalizeAllowed(input.allowed),
    completesWhen: normalizeCompletion(input.completesWhen),
    onEnter: normalizeStepEffect(input.onEnter),
    onComplete: normalizeStepEffect(input.onComplete),
    next: nullableText(input.next),
    nextScenario: nullableText(input.nextScenario),
  };
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
  });
}

function normalizeStepEffect(input = {}) {
  if (!input || typeof input !== "object") return null;
  return compactObject({
    setFlags: stringList(input.setFlags),
    effects: array(input.effects).map((effect) => structuredClone(effect)),
    timeMinutes: nullableNumber(input.timeMinutes),
    activity: nullableText(input.activity),
    move: normalizeLocation(input.move),
    view: normalizeStageView(input.view),
  });
}

function normalizeLocation(input = {}) {
  if (!input || typeof input !== "object") return null;
  return compactObject({
    place: nullableText(input.place),
    hex: nullableText(input.hex),
    room: nullableText(input.room),
    exteriorNode: nullableText(input.exteriorNode),
  });
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
  const families = ["flag", "facility", "location", "holding", "lesson"]
    .filter((key) => hasCompletionValue(completion[key]));
  if (families.length !== 1) add(path, "Choose exactly one completion predicate.");
  if (completion.flag && !FLAG_PATTERN.test(completion.flag)) add(`${path}.flag`, "Use a valid flag ID.");
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

function validateStepEffect(effect, path, add, { world, character }) {
  if (!effect) return;
  effect.setFlags?.forEach((flag, index) => {
    if (!FLAG_PATTERN.test(flag)) add(`${path}.setFlags.${index}`, "Use a valid flag ID.");
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
  if (location.hex) validateWorldIds([location.hex], world?.hexIds, `${path}.hex`, add, "hex");
  if (location.room) validateWorldIds([location.room], world?.roomIds, `${path}.room`, add, "room");
  if (location.exteriorNode) {
    validateWorldIds([location.exteriorNode], world?.exteriorNodeIds, `${path}.exteriorNode`, add, "exterior node");
  }
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

function validateWorldIds(ids, catalog, path, add, label) {
  if (!catalog) return;
  ids.forEach((id, index) => {
    if (!catalog.has(id)) add(Array.isArray(ids) && ids.length > 1 ? `${path}.${index}` : path, `Choose an existing ${label}.`);
  });
}

function storyBeatIds(story) {
  const ids = new Set();
  for (const area of story?.areas ?? []) {
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
