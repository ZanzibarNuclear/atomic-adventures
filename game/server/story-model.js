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
const TRANSITION_DIRECTIONS = new Set(["toLocal", "toRegional"]);
const PLAY_MODES = new Set(["story", "open-world"]);

export function normalizeBeat(input = {}) {
  const trigger = input.trigger ?? {};
  return {
    id: String(input.id ?? "").trim(),
    once: input.once !== false,
    eyebrow: nullableText(input.eyebrow),
    heading: nullableText(input.heading),
    text: String(input.text ?? ""),
    revisit: nullableText(input.revisit),
    modes: stringList(input.modes).map(normalizePlayMode),
    storylineStep: nullableText(input.storylineStep),
    trigger: {
      place: nullableText(trigger.place),
      hex: nullableText(trigger.hex),
      room: nullableText(trigger.room),
      exteriorNode: nullableText(trigger.exteriorNode),
      event: nullableText(trigger.event),
      flag: nullableText(trigger.flag),
    },
    match: normalizeMatch(input.match),
    time: normalizeBeatTime(input.time),
    choices: (input.choices ?? []).map((choice, index) => ({
      id: choice.id || randomUUID(),
      order: Number.isFinite(Number(choice.order)) ? Number(choice.order) : index,
      text: String(choice.text ?? ""),
      timeMinutes: finiteNumber(choice.timeMinutes, 0),
      timeUntil: normalizeTimeUntil(choice.timeUntil),
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

export function validateBeat(input, world, character = null, learning = null) {
  const beat = normalizeBeat(input);
  const errors = {};
  const add = (path, message) => {
    (errors[path] ??= []).push(message);
  };

  if (Object.hasOwn(input ?? {}, "require")) {
    add("require", "Story beat requirements are not part of the current schema.");
  }
  if (Array.isArray(input?.choices)) {
    input.choices.forEach((choice, index) => {
      if (Object.hasOwn(choice ?? {}, "require")) {
        add(`choices.${index}.require`, "Story choice requirements are not part of the current schema.");
      }
      if (Object.hasOwn(choice ?? {}, "effects")) {
        add(`choices.${index}.effects`, "Story choice effects are not part of the current schema.");
      }
    });
  }

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
  const originHexes = stringList(beat.match.originHex);
  if (originHexes.length) {
    if (!beat.trigger.hex) add("match.originHex", "Origin hex matching is only supported for outdoor hex beats.");
    for (const originHex of originHexes) {
      if (!world.hexIds.has(originHex)) add("match.originHex", "Choose existing origin hexes.");
    }
  }
  if (beat.match.mapTransition) {
    if (!world.mapTransitionIds?.has(beat.match.mapTransition)) add("match.mapTransition", "Choose an existing map transition.");
    if (beat.match.transitionDirection === "toRegional" && !beat.trigger.hex) {
      add("match.mapTransition", "Regional map transition beats must use an outdoor hex trigger.");
    }
    if (beat.match.transitionDirection === "toLocal" && beat.trigger.place !== "indoors") {
      add("match.mapTransition", "Local map transition beats must use an indoor trigger.");
    }
  }
  if (beat.match.transitionDirection && !TRANSITION_DIRECTIONS.has(beat.match.transitionDirection)) {
    add("match.transitionDirection", "Choose to local or to regional.");
  }
  validateBeatTime(beat.time, add);
  beat.modes.forEach((mode, index) => {
    if (!PLAY_MODES.has(mode)) add(`modes.${index}`, "Choose story or open-world.");
  });
  if (beat.storylineStep && !ID_PATTERN.test(beat.storylineStep)) {
    add("storylineStep", "Use a kebab-case storyline step ID.");
  }
  if (beat.storylineStep && beat.modes.length && !beat.modes.includes("story")) {
    add("storylineStep", "Storyline step beats must be eligible in story mode.");
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
    if (choice.view?.kind === "lesson") {
      const lessonId = choice.view.id;
      const lessonIds = new Set((learning?.lessons ?? []).map((lesson) => lesson.id));
      if (!lessonId) {
        add(`${base}.view.id`, "Choose a lesson.");
      } else if (learning && !lessonIds.has(lessonId)) {
        add(`${base}.view.id`, "Choose an existing lesson.");
      }
    }
    if (choice.timeMinutes < 0) add(`${base}.timeMinutes`, "Time cannot be negative.");
    if (choice.timeMinutes > 0 && choice.timeUntil) {
      add(`${base}.timeMinutes`, "Choose fixed minutes or sleep until, not both.");
    }
    validateTimeUntil(choice.timeUntil, add, `${base}.timeUntil`);
    if (!["resting", "light", "moderate", "strenuous"].includes(choice.activity)) {
      add(`${base}.activity`, "Choose a supported activity profile.");
    }
  });
  return { beat, errors, valid: Object.keys(errors).length === 0 };
}

export function beatToRuntime(beat) {
  const match = compactObject(beat.match ?? {});
  const time = compactTime(beat.time ?? {});
  const modes = stringList(beat.modes);
  return compactObject({
    eyebrow: beat.eyebrow ?? undefined,
    heading: beat.heading ?? undefined,
    trigger: compactObject(beat.trigger),
    modes: modes.length ? modes : undefined,
    storylineStep: beat.storylineStep ?? undefined,
    match: Object.keys(match).length ? match : undefined,
    time: Object.keys(time).length ? time : undefined,
    text: beat.text,
    revisit: beat.revisit ?? undefined,
    choices: beat.choices.map((choice) => compactObject({
      text: choice.text,
      timeMinutes: choice.timeMinutes || undefined,
      timeUntil: compactTimeUntil(choice.timeUntil),
      activity: choice.timeMinutes || choice.timeUntil ? choice.activity : undefined,
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
  const mapTransition = nullableText(value.mapTransition);
  return {
    originHex: originHexValue(value.originHex),
    mapTransition: mapTransition ?? null,
    transitionDirection: nullableText(value.transitionDirection),
  };
}

function originHexValue(value) {
  const origins = stringList(value);
  if (!origins.length) return null;
  return origins.length === 1 ? origins[0] : origins;
}

function normalizeBeatTime(value = {}) {
  return {
    days: numberList(value.days),
    dayFrom: nullableInteger(value.dayFrom),
    dayTo: nullableInteger(value.dayTo),
    minuteOfDayFrom: nullableMinute(value.minuteOfDayFrom),
    minuteOfDayTo: nullableMinute(value.minuteOfDayTo),
    phase: nullableText(value.phase),
    elapsedFrom: nullableNumber(value.elapsedFrom),
    elapsedTo: nullableNumber(value.elapsedTo),
    afterMilestone: nullableText(value.afterMilestone),
    beforeMilestone: nullableText(value.beforeMilestone),
  };
}

function validateBeatTime(time, add) {
  if (!time) return;
  if (time.days.some((day) => day < 1)) add("time.days", "Days must be one or greater.");
  if (time.dayFrom != null && time.dayFrom < 1) add("time.dayFrom", "Start day must be one or greater.");
  if (time.dayTo != null && time.dayTo < 1) add("time.dayTo", "End day must be one or greater.");
  if (time.dayFrom != null && time.dayTo != null && time.dayTo < time.dayFrom) {
    add("time.dayTo", "End day must be after start day.");
  }
  if (time.elapsedFrom != null && time.elapsedFrom < 0) add("time.elapsedFrom", "Elapsed start cannot be negative.");
  if (time.elapsedTo != null && time.elapsedTo < 0) add("time.elapsedTo", "Elapsed end cannot be negative.");
  if (time.elapsedFrom != null && time.elapsedTo != null && time.elapsedTo < time.elapsedFrom) {
    add("time.elapsedTo", "Elapsed end must be after elapsed start.");
  }
  if (time.phase && !["morning", "afternoon", "evening", "night"].includes(time.phase)) {
    add("time.phase", "Choose a supported time phase.");
  }
}

function normalizeTimeUntil(value = null) {
  if (!value || typeof value !== "object") return null;
  const day = nullableInteger(value.day);
  const dayOffset = nullableInteger(value.dayOffset);
  const minuteOfDay = nullableMinute(value.minuteOfDay);
  if (day == null && dayOffset == null && minuteOfDay == null) return null;
  return { day, dayOffset, minuteOfDay };
}

function validateTimeUntil(value, add, base) {
  if (!value) return;
  if (value.day != null && value.day < 1) add(`${base}.day`, "Wake day must be one or greater.");
  if (value.dayOffset != null && value.dayOffset < 0) add(`${base}.dayOffset`, "Wake day offset cannot be negative.");
  if (value.day != null && value.dayOffset != null) {
    add(`${base}.day`, "Choose an absolute day or day offset, not both.");
  }
  if (value.minuteOfDay == null) add(`${base}.minuteOfDay`, "Wake time is required.");
}

function compactTime(value = {}) {
  return compactObject({
    days: value.days?.length ? value.days : undefined,
    dayFrom: value.dayFrom ?? undefined,
    dayTo: value.dayTo ?? undefined,
    minuteOfDayFrom: value.minuteOfDayFrom ?? undefined,
    minuteOfDayTo: value.minuteOfDayTo ?? undefined,
    phase: value.phase ?? undefined,
    elapsedFrom: value.elapsedFrom ?? undefined,
    elapsedTo: value.elapsedTo ?? undefined,
    afterMilestone: value.afterMilestone ?? undefined,
    beforeMilestone: value.beforeMilestone ?? undefined,
  });
}

function compactTimeUntil(value) {
  if (!value) return undefined;
  return compactObject({
    day: value.day ?? undefined,
    dayOffset: value.dayOffset ?? undefined,
    minuteOfDay: value.minuteOfDay ?? undefined,
  });
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizePlayMode(mode) {
  return mode === "storyline" ? "story" : mode;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableInteger(value) {
  const number = nullableNumber(value);
  return number == null ? null : Math.floor(number);
}

function nullableMinute(value) {
  const number = nullableInteger(value);
  if (number == null) return null;
  if (number < 0 || number > 1439) return null;
  return number;
}

function numberList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.floor(item));
}
