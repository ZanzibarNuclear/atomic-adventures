import { randomUUID } from "node:crypto";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBeat(input = {}) {
  const trigger = input.trigger ?? {};
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
    require: normalizeRequirements(input.require),
    choices: (input.choices ?? []).map((choice, index) => ({
      id: choice.id || randomUUID(),
      order: Number.isFinite(Number(choice.order)) ? Number(choice.order) : index,
      text: String(choice.text ?? ""),
      require: normalizeRequirements(choice.require),
      effects: normalizeEffects(choice.effects),
      timeMinutes: finiteNumber(choice.timeMinutes, 0),
      activity: nullableText(choice.activity) ?? "light",
      sets: stringList(choice.sets),
      set_flags: stringList(choice.set_flags),
      go_hex: nullableText(choice.go_hex),
      go_room: nullableText(choice.go_room),
      enter: nullableText(choice.enter),
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

  beat.choices.forEach((choice, index) => {
    const base = `choices.${index}`;
    if (!choice.text.trim()) add(`${base}.text`, "Choice text is required.");
    const destinations = [choice.go_hex, choice.go_room, choice.enter].filter(Boolean);
    if (destinations.length > 1) add(`${base}.destination`, "Choose at most one movement destination.");
    if (choice.go_hex && !world.hexIds.has(choice.go_hex)) add(`${base}.go_hex`, "Choose an existing hex.");
    if (choice.go_room && !world.roomIds.has(choice.go_room)) add(`${base}.go_room`, "Choose an existing room.");
    if (choice.enter && !world.buildingIds.has(choice.enter)) add(`${base}.enter`, "Choose an existing building.");
    validateCharacterReferences(choice.require, `${base}.require`, character, add);
    validateEffectReferences(choice.effects, `${base}.effects`, character, add);
    if (choice.timeMinutes < 0) add(`${base}.timeMinutes`, "Time cannot be negative.");
    if (!["resting", "light", "moderate", "strenuous"].includes(choice.activity)) {
      add(`${base}.activity`, "Choose a supported activity profile.");
    }
  });
  validateCharacterReferences(beat.require, "require", character, add);

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
      require: compactRequirements(choice.require),
      effects: choice.effects.length ? choice.effects : undefined,
      timeMinutes: choice.timeMinutes || undefined,
      activity: choice.timeMinutes ? choice.activity : undefined,
      sets: choice.sets.length ? choice.sets : undefined,
      set_flags: choice.set_flags.length ? choice.set_flags : undefined,
      go_hex: choice.go_hex ?? undefined,
      go_room: choice.go_room ?? undefined,
      enter: choice.enter ?? undefined,
    })),
  });
}

function compactRequirements(require) {
  const result = structuredClone(require ?? {});
  if (result.flags && !Object.values(result.flags).some((value) => value?.length)) delete result.flags;
  for (const key of ["all", "any", "not"]) if (!result[key]?.length) delete result[key];
  for (const key of ["stats", "skills", "evidence", "quests"]) if (!result[key]?.length) delete result[key];
  for (const key of ["items", "knowledge", "documents"]) {
    if (Array.isArray(result[key]) && !result[key].length) delete result[key];
    else if (result[key] && !Object.values(result[key]).some((value) => value?.length)) delete result[key];
  }
  return Object.keys(result).length ? result : undefined;
}

function normalizeRequirements(value) {
  const source = value && typeof value === "object" ? structuredClone(value) : {};
  const legacy = {
    all: stringList(source.all),
    any: stringList(source.any),
    not: stringList(source.not),
  };
  delete source.all;
  delete source.any;
  delete source.not;
  if (source.flags && typeof source.flags === "object") {
    source.flags = {
      all: stringList(source.flags.all),
      any: stringList(source.flags.any),
      not: stringList(source.flags.not),
    };
    return source;
  }
  return { ...source, ...legacy };
}

function normalizeEffects(value) {
  return Array.isArray(value)
    ? value.filter((effect) => effect && typeof effect === "object").map((effect) => structuredClone(effect))
    : [];
}

function validateCharacterReferences(require, path, character, add) {
  if (!character) return;
  const catalogs = characterCatalogs(character);
  validateGroupReferences(require.items, catalogs.items, `${path}.items`, add);
  validateGroupReferences(require.knowledge, catalogs.knowledge, `${path}.knowledge`, add);
  validateGroupReferences(require.documents, catalogs.documents, `${path}.documents`, add);
  for (const [key, catalog] of [["stats", catalogs.stats], ["skills", catalogs.skills], ["quests", catalogs.quests]]) {
    for (const [index, condition] of (require[key] ?? []).entries()) {
      if (!catalog.has(condition?.id)) add(`${path}.${key}.${index}.id`, `Unknown ${key.slice(0, -1)} "${condition?.id}".`);
    }
  }
  for (const [index, condition] of (require.evidence ?? []).entries()) {
    if (!catalogs.skills.has(condition?.skill)) {
      add(`${path}.evidence.${index}.skill`, `Unknown skill "${condition?.skill}".`);
    }
  }
}

function validateEffectReferences(effects, path, character, add) {
  if (!character) return;
  const catalogs = characterCatalogs(character);
  const domains = {
    item: catalogs.items,
    stat: catalogs.stats,
    knowledge: catalogs.knowledge,
    skill: catalogs.skills,
    quest: catalogs.quests,
    document: catalogs.documents,
  };
  effects.forEach((effect, index) => {
    const domain = String(effect.op ?? "").split(".")[0];
    if (domain === "flag") return;
    if (!domains[domain]) {
      add(`${path}.${index}.op`, `Unknown effect domain "${domain || "missing"}".`);
    } else if (!domains[domain].has(effect.id)) {
      add(`${path}.${index}.id`, `Unknown ${domain} "${effect.id}".`);
    }
    if (effect.op === "skill.add-evidence") {
      const skill = (character.skills ?? []).find((entry) => entry.id === effect.id);
      if (!skill?.practice?.evidence?.some((entry) => entry.id === effect.evidence)) {
        add(`${path}.${index}.evidence`, `Unknown evidence "${effect.evidence}" for skill "${effect.id}".`);
      }
      if (effect.once === true && !String(effect.event ?? "").trim()) {
        add(`${path}.${index}.event`, "One-time evidence requires an event ID.");
      }
      if (!Number.isFinite(Number(effect.value ?? 1)) || Number(effect.value ?? 1) <= 0) {
        add(`${path}.${index}.value`, "Evidence value must be a positive number.");
      }
    }
    if (["quest.advance-objective", "quest.complete-objective"].includes(effect.op)) {
      const quest = (character.quests ?? []).find((entry) => entry.id === effect.id);
      if (!quest?.objectives?.some((entry) => entry.id === effect.objective)) {
        add(`${path}.${index}.objective`, `Unknown objective "${effect.objective}" for quest "${effect.id}".`);
      }
      if (
        effect.op === "quest.advance-objective" &&
        (!Number.isFinite(Number(effect.value ?? 1)) || Number(effect.value ?? 1) <= 0)
      ) {
        add(`${path}.${index}.value`, "Objective progress must be a positive number.");
      }
    }
  });
}

function validateGroupReferences(value, catalog, path, add) {
  const groups = Array.isArray(value) ? { all: value } : value ?? {};
  for (const key of ["all", "any", "not"]) {
    (groups[key] ?? []).forEach((entry, index) => {
      const id = typeof entry === "string" ? entry : entry?.id;
      if (!catalog.has(id)) add(`${path}.${key}.${index}`, `Unknown reference "${id}".`);
    });
  }
}

function characterCatalogs(character) {
  return Object.fromEntries(
    ["items", "stats", "knowledge", "skills", "quests", "documents"]
      .map((key) => [key, new Set((character[key] ?? []).map((entry) => entry.id))]),
  );
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

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
