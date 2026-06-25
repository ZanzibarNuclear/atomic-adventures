import { randomUUID } from "node:crypto";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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

export function normalizeBeat(input = {}) {
  const trigger = input.trigger ?? {};
  return {
    id: String(input.id ?? "").trim(),
    once: input.once !== false,
    eyebrow: nullableText(input.eyebrow),
    heading: nullableText(input.heading),
    text: String(input.text ?? ""),
    revisit: nullableText(input.revisit),
    trigger: {
      place: nullableText(trigger.place),
      hex: nullableText(trigger.hex),
      room: nullableText(trigger.room),
      exteriorNode: nullableText(trigger.exteriorNode),
      event: nullableText(trigger.event),
      flag: nullableText(trigger.flag),
    },
    match: normalizeMatch(input.match),
    choices: (input.choices ?? []).map((choice, index) => ({
      id: choice.id || randomUUID(),
      order: Number.isFinite(Number(choice.order)) ? Number(choice.order) : index,
      text: String(choice.text ?? ""),
      timeMinutes: finiteNumber(choice.timeMinutes, 0),
      activity: nullableText(choice.activity) ?? "light",
      sets: stringList(choice.sets),
      set_flags: stringList(choice.set_flags),
      go_hex: nullableText(choice.go_hex),
      go_room: nullableText(choice.go_room),
      go_exterior_node: nullableText(choice.go_exterior_node),
      enter: nullableText(choice.enter),
      view: normalizeStageView(choice.view),
    })),
  };
}

export function validateBeat(input, world, character = null) {
  const beat = normalizeBeat(input);
  const errors = {};
  const add = (path, message) => {
    (errors[path] ??= []).push(message);
  };

  if (!ID_PATTERN.test(beat.id)) add("id", "Use a kebab-case beat ID.");
  if (!beat.text.trim()) add("text", "Story text is required.");

  const triggerLocations = [
    beat.trigger.hex,
    beat.trigger.room,
    beat.trigger.exteriorNode,
    beat.trigger.event,
  ].filter(Boolean);
  if (triggerLocations.length !== 1) {
    add("trigger", "Choose exactly one hex, room, exterior node, or event trigger.");
  }
  if (beat.trigger.hex && beat.trigger.place !== "outdoors") {
    add("trigger.place", "Hex triggers must use the outdoors place.");
  }
  if ((beat.trigger.room || beat.trigger.exteriorNode) && beat.trigger.place !== "indoors") {
    add("trigger.place", "Room and exterior-node triggers must use the indoors place.");
  }
  if (beat.trigger.event && beat.trigger.place) {
    add("trigger.place", "Event triggers do not use a place.");
  }
  if (beat.trigger.hex && !world.hexIds.has(beat.trigger.hex)) {
    add("trigger.hex", "Choose an existing world hex.");
  }
  if (beat.trigger.room && !world.roomIds.has(beat.trigger.room)) {
    add("trigger.room", "Choose an existing room.");
  }
  if (beat.trigger.exteriorNode && !world.exteriorNodeIds.has(beat.trigger.exteriorNode)) {
    add("trigger.exteriorNode", "Choose an existing exterior node.");
  }
  if (beat.match.originHex) {
    if (!beat.trigger.hex) add("match.originHex", "Origin hex matching is only supported for outdoor hex beats.");
    if (!world.hexIds.has(beat.match.originHex)) add("match.originHex", "Choose an existing origin hex.");
  }

  beat.choices.forEach((choice, index) => {
    const base = `choices.${index}`;
    if (!choice.text.trim()) add(`${base}.text`, "Choice text is required.");
    const destinations = [
      choice.go_hex,
      choice.go_room,
      choice.go_exterior_node,
      choice.enter,
    ].filter(Boolean);
    if (destinations.length > 1) add(`${base}.destination`, "Choose at most one movement destination.");
    if (destinations.length && choice.view) add(`${base}.destination`, "Choose either movement or a stage view.");
    if (choice.go_hex && !world.hexIds.has(choice.go_hex)) add(`${base}.go_hex`, "Choose an existing hex.");
    if (choice.go_room && !world.roomIds.has(choice.go_room)) add(`${base}.go_room`, "Choose an existing room.");
    if (choice.go_exterior_node && !world.exteriorNodeIds.has(choice.go_exterior_node)) {
      add(`${base}.go_exterior_node`, "Choose an existing exterior node.");
    }
    if (choice.enter && !world.buildingIds.has(choice.enter)) add(`${base}.enter`, "Choose an existing building.");
    if (choice.view && !STAGE_VIEW_KINDS.has(choice.view.kind)) {
      add(`${base}.view.kind`, "Choose a supported stage view.");
    }
    if (choice.timeMinutes < 0) add(`${base}.timeMinutes`, "Time cannot be negative.");
    if (!["resting", "light", "moderate", "strenuous"].includes(choice.activity)) {
      add(`${base}.activity`, "Choose a supported activity profile.");
    }
  });
  return { beat, errors, valid: Object.keys(errors).length === 0 };
}

export function beatToRuntime(beat) {
  const match = compactObject(beat.match ?? {});
  return compactObject({
    eyebrow: beat.eyebrow ?? undefined,
    heading: beat.heading ?? undefined,
    trigger: compactObject(beat.trigger),
    match: Object.keys(match).length ? match : undefined,
    text: beat.text,
    revisit: beat.revisit ?? undefined,
    choices: beat.choices.map((choice) => compactObject({
      text: choice.text,
      timeMinutes: choice.timeMinutes || undefined,
      activity: choice.timeMinutes ? choice.activity : undefined,
      sets: choice.sets.length ? choice.sets : undefined,
      set_flags: choice.set_flags.length ? choice.set_flags : undefined,
      go_hex: choice.go_hex ?? undefined,
      go_room: choice.go_room ?? undefined,
      go_exterior_node: choice.go_exterior_node ?? undefined,
      enter: choice.enter ?? undefined,
      view: choice.view ?? undefined,
    })),
  });
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

function nullableText(value) {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

function normalizeStageView(value) {
  if (!value || typeof value !== "object") return null;
  const kind = nullableText(value.kind);
  if (!kind) return null;
  return compactObject({
    kind,
    focus: nullableText(value.focus) ?? undefined,
    id: nullableText(value.id) ?? undefined,
    tab: nullableText(value.tab) ?? undefined,
  });
}

function normalizeMatch(value = {}) {
  return {
    originHex: nullableText(value.originHex),
  };
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
