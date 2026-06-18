import { randomUUID } from "node:crypto";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBeat(input = {}) {
  const trigger = input.trigger ?? {};
  const require = input.require ?? {};
  return {
    id: String(input.id ?? "").trim(),
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : 0,
    once: input.once !== false,
    acknowledge: input.acknowledge !== false,
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
    require: {
      all: stringList(require.all),
      any: stringList(require.any),
      not: stringList(require.not),
    },
    choices: (input.choices ?? []).map((choice, index) => ({
      id: choice.id || randomUUID(),
      order: Number.isFinite(Number(choice.order)) ? Number(choice.order) : index,
      text: String(choice.text ?? ""),
      sets: stringList(choice.sets),
      set_flags: stringList(choice.set_flags),
      go_hex: nullableText(choice.go_hex),
      go_room: nullableText(choice.go_room),
      enter: nullableText(choice.enter),
    })),
  };
}

export function validateBeat(input, world) {
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

  beat.choices.forEach((choice, index) => {
    const base = `choices.${index}`;
    if (!choice.text.trim()) add(`${base}.text`, "Choice text is required.");
    const destinations = [choice.go_hex, choice.go_room, choice.enter].filter(Boolean);
    if (destinations.length > 1) add(`${base}.destination`, "Choose at most one movement destination.");
    if (choice.go_hex && !world.hexIds.has(choice.go_hex)) add(`${base}.go_hex`, "Choose an existing hex.");
    if (choice.go_room && !world.roomIds.has(choice.go_room)) add(`${base}.go_room`, "Choose an existing room.");
    if (choice.enter && !world.buildingIds.has(choice.enter)) add(`${base}.enter`, "Choose an existing building.");
  });

  return { beat, errors, valid: Object.keys(errors).length === 0 };
}

export function beatToRuntime(beat) {
  return compactObject({
    once: beat.once,
    acknowledge: beat.acknowledge,
    eyebrow: beat.eyebrow ?? undefined,
    heading: beat.heading ?? undefined,
    trigger: compactObject(beat.trigger),
    text: beat.text,
    revisit: beat.revisit ?? undefined,
    require: compactRequirements(beat.require),
    choices: beat.choices.map((choice) => compactObject({
      text: choice.text,
      sets: choice.sets.length ? choice.sets : undefined,
      set_flags: choice.set_flags.length ? choice.set_flags : undefined,
      go_hex: choice.go_hex ?? undefined,
      go_room: choice.go_room ?? undefined,
      enter: choice.enter ?? undefined,
    })),
  });
}

function compactRequirements(require) {
  const result = {};
  for (const key of ["all", "any", "not"]) {
    if (require[key]?.length) result[key] = require[key];
  }
  return Object.keys(result).length ? result : undefined;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}

function nullableText(value) {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}
