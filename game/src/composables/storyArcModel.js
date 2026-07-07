const DEFAULT_ARC_ID = "part-i-opener";

export function normalizeStoryArcContent(input = {}, { storyData = null } = {}) {
  const source = input?.storyline ?? input ?? {};
  const proseBeats = storyData?.beats ?? {};
  const arcs = Array.isArray(source.storyArcs)
    ? source.storyArcs
    : Array.isArray(source.arcs)
      ? source.arcs
      : Array.isArray(source.scenarios)
        ? source.scenarios
        : [];

  return {
    id: text(source.id) || "story-main",
    storyArcs: arcs.map((arc, index) => normalizeStoryArc(arc, index, proseBeats)),
  };
}

export function normalizeStoryArc(source = {}, index = 0, proseBeats = {}) {
  const rawBeats = Array.isArray(source.beats)
    ? source.beats
    : Array.isArray(source.steps)
      ? source.steps
      : [];
  const id = text(source.id) || `${DEFAULT_ARC_ID}-${index + 1}`;
  const startBeat = text(source.startBeat) || text(source.startStep) || text(rawBeats[0]?.id) || null;

  return {
    ...source,
    id,
    title: text(source.title) || text(source.label) || id,
    protagonist: text(source.protagonist) || null,
    startBeat,
    beats: rawBeats.map((beat, beatIndex) => normalizeStoryBeat(beat, beatIndex, proseBeats)),
  };
}

export function normalizeStoryBeat(source = {}, index = 0, proseBeats = {}) {
  const proseBeatId = text(source.scene) || text(source.beat);
  const proseBeat = proseBeatId ? proseBeats[proseBeatId] : null;
  const scenes = Array.isArray(source.scenes)
    ? source.scenes
    : proseBeat
      ? [sceneFromProseBeat(proseBeatId, proseBeat)]
      : [];
  const choices = Array.isArray(source.choices)
    ? source.choices
    : Array.isArray(proseBeat?.choices)
      ? proseBeat.choices
      : [];
  const id = text(source.id) || `story-beat-${index + 1}`;

  return {
    ...source,
    id,
    title: text(source.title) || text(source.label) || text(source.objective) || id,
    scenes: scenes.map((scene, sceneIndex) => normalizeScene(scene, sceneIndex)),
    choices: choices.map((choice, choiceIndex) => normalizeChoice(choice, choiceIndex)),
    authoredActions: normalizeAuthoredActions(source.authoredActions, source.allowed),
    completesWhen: source.completesWhen ?? source.completionCondition ?? null,
    onEnter: source.onEnter ?? null,
    onComplete: source.onComplete ?? null,
    next: text(source.next) || null,
    nextArc: text(source.nextArc) || text(source.nextScenario) || null,
  };
}

export function normalizeScene(source = {}, index = 0) {
  const id = text(source.id) || text(source.sceneId) || `scene-${index + 1}`;
  return {
    ...source,
    id,
    trigger: source.trigger ?? {},
    conditions: source.conditions ?? null,
    modes: normalizeStringArray(source.modes),
    match: source.match ?? {},
    time: source.time ?? {},
    prose: text(source.prose) || text(source.text),
    revisitProse: text(source.revisitProse) || text(source.revisit),
  };
}

export function selectSceneForBeat(beat, context = {}) {
  const scenes = Array.isArray(beat?.scenes) ? beat.scenes : [];
  const loc = context.location ?? {};
  const event = context.event ?? null;
  const action = context.actionContext ?? sceneActionContext(loc, event);
  let selected = null;
  let selectedScore = -1;

  for (const scene of scenes) {
    if (!triggerMatches(scene, loc, event)) continue;
    if (!modeMatches(scene, context)) continue;
    if (!timeMatches(scene, context)) continue;
    if (!flagMatches(scene, context)) continue;
    const score = matchScore(scene, loc, action) + timeScore(scene);
    if (score < 0 || score <= selectedScore) continue;
    selected = scene;
    selectedScore = score;
  }

  return selected;
}

export function sceneActionContext(loc, event = null) {
  if (event) return "event";
  if (loc.place === "outdoors" && loc.mapTransition && loc.transitionDirection === "toRegional") return "exitLocalMap";
  if (loc.place === "outdoors" && loc.originHex) return "enterOutdoorHex";
  if (loc.place === "indoors") return "enterIndoorLocation";
  return "ambientRefresh";
}

function sceneFromProseBeat(id, beat) {
  return {
    id,
    trigger: beat.trigger ?? {},
    modes: beat.modes ?? [],
    match: beat.match ?? {},
    time: beat.time ?? {},
    prose: beat.text ?? "",
    revisitProse: beat.revisit ?? "",
    eyebrow: beat.eyebrow,
    heading: beat.heading,
    storylineStep: beat.storylineStep,
  };
}

function normalizeChoice(choice = {}, index = 0) {
  const label = text(choice.label) || text(choice.text) || `Choice ${index + 1}`;
  return {
    ...choice,
    id: text(choice.id) || choiceId(label, index),
    label,
  };
}

function normalizeAuthoredActions(authoredActions, allowed = {}) {
  if (Array.isArray(authoredActions)) return authoredActions.map(normalizeAuthoredAction).filter(Boolean);
  const actions = [];
  for (const id of normalizeStringArray(allowed?.storyForwardActions)) {
    actions.push(normalizeAuthoredAction({ id, role: "story" }));
  }
  for (const id of normalizeStringArray(allowed?.optionalActions)) {
    actions.push(normalizeAuthoredAction({ id, role: "optional" }));
  }
  for (const id of normalizeStringArray(allowed?.itemActions)) {
    actions.push(normalizeAuthoredAction({ id: `item-action:${id}`, role: "survival" }));
  }
  for (const view of Array.isArray(allowed?.stageViews) ? allowed.stageViews : []) {
    const id = view?.id ? `stage-view:${view.kind}:${view.id}` : `stage-view:${view?.kind}`;
    actions.push(normalizeAuthoredAction({ id, kind: "stageView", role: "utility", view }));
  }
  return actions.filter(Boolean);
}

function normalizeAuthoredAction(action) {
  if (typeof action === "string") return { id: action, kind: actionKind(action), role: "story" };
  const id = text(action?.id);
  if (!id) return null;
  return {
    ...action,
    id,
    kind: text(action.kind) || actionKind(id),
    role: text(action.role) || "story",
  };
}

function triggerMatches(scene, loc, event) {
  const trigger = scene.trigger ?? {};
  if (event && !trigger.event) return false;
  if (trigger.event) return event === trigger.event;
  if (trigger.place && trigger.place !== loc.place) return false;
  if (trigger.hex && (loc.place !== "outdoors" || trigger.hex !== loc.hex)) return false;
  if (trigger.room && (loc.place !== "indoors" || trigger.room !== loc.room)) return false;
  if (trigger.exteriorNode && (loc.place !== "indoors" || trigger.exteriorNode !== loc.exteriorNode)) return false;
  return true;
}

function modeMatches(scene, context) {
  const modes = normalizeStringArray(scene.modes);
  const mode = context.playMode ?? "story";
  if (modes.length && !modes.includes(mode)) return false;
  return true;
}

function flagMatches(scene, context) {
  const flags = context.flags ?? new Set();
  const triggerFlag = scene.trigger?.flag;
  if (triggerFlag && !hasValue(flags, triggerFlag)) return false;
  const conditions = scene.conditions ?? {};
  if (conditions.flag && !hasValue(flags, conditions.flag)) return false;
  return true;
}

function timeMatches(scene, context) {
  const time = scene.time ?? {};
  if (!hasTimeCriteria(time)) return true;
  const clock = context.clock;
  if (!clock) return false;
  const day = Number(clock.day);
  const minuteOfDay = Math.floor(Number(clock.minuteOfDay));
  const elapsedMinutes = Number(clock.elapsedMinutes);

  if (Array.isArray(time.days) && time.days.length && !time.days.includes(day)) return false;
  if (time.dayFrom != null && day < Number(time.dayFrom)) return false;
  if (time.dayTo != null && day > Number(time.dayTo)) return false;
  if (time.elapsedFrom != null && elapsedMinutes < Number(time.elapsedFrom)) return false;
  if (time.elapsedTo != null && elapsedMinutes > Number(time.elapsedTo)) return false;
  if (!minuteWindowMatches(time, minuteOfDay)) return false;
  if (time.afterMilestone && !hasValue(context.milestones ?? context.flags, time.afterMilestone)) return false;
  if (time.beforeMilestone && hasValue(context.milestones ?? context.flags, time.beforeMilestone)) return false;
  return true;
}

function matchScore(scene, loc, action) {
  const match = scene.match ?? {};
  const originHexes = normalizeStringArray(match.originHex);
  const hasOriginHex = originHexes.length > 0;
  const hasMapTransition = Boolean(match.mapTransition);
  const hasMatch = Boolean(hasOriginHex || hasMapTransition || match.transitionDirection);
  let relevant = 0;
  let score = 0;

  if (action === "enterOutdoorHex" && hasOriginHex) {
    relevant += 1;
    if (loc.place !== "outdoors" || !originHexes.includes(loc.originHex)) return -1;
    score += 1;
  }
  if (
    hasMapTransition &&
    (action === "exitLocalMap" || action === "enterIndoorLocation") &&
    (!match.transitionDirection ||
      (match.transitionDirection === "toRegional" && action === "exitLocalMap") ||
      (match.transitionDirection === "toLocal" && action === "enterIndoorLocation"))
  ) {
    relevant += 1;
    if (!loc.mapTransition || match.mapTransition !== loc.mapTransition) return -1;
    score += 1;
  }
  if (match.transitionDirection && (action === "exitLocalMap" || action === "enterIndoorLocation")) {
    relevant += 1;
    if (match.transitionDirection !== loc.transitionDirection) return -1;
    score += 1;
  }
  if (hasMatch && relevant === 0) return -1;
  return score;
}

function timeScore(scene) {
  const time = scene.time ?? {};
  if (!hasTimeCriteria(time)) return 0;
  let score = 0;
  if (Array.isArray(time.days) && time.days.length) score += 1;
  if (time.dayFrom != null || time.dayTo != null) score += 1;
  if (time.minuteOfDayFrom != null || time.minuteOfDayTo != null) score += 1;
  if (time.elapsedFrom != null || time.elapsedTo != null) score += 1;
  if (time.afterMilestone) score += 1;
  if (time.beforeMilestone) score += 1;
  return score;
}

function hasTimeCriteria(time = {}) {
  return Boolean(
    (Array.isArray(time.days) && time.days.length) ||
    time.dayFrom != null ||
    time.dayTo != null ||
    time.minuteOfDayFrom != null ||
    time.minuteOfDayTo != null ||
    time.elapsedFrom != null ||
    time.elapsedTo != null ||
    time.afterMilestone ||
    time.beforeMilestone,
  );
}

function minuteWindowMatches(time, minuteOfDay) {
  const from = time.minuteOfDayFrom == null ? null : Number(time.minuteOfDayFrom);
  const to = time.minuteOfDayTo == null ? null : Number(time.minuteOfDayTo);
  if (from == null && to == null) return true;
  if (from != null && to != null && from > to) {
    return minuteOfDay >= from || minuteOfDay <= to;
  }
  if (from != null && minuteOfDay < from) return false;
  if (to != null && minuteOfDay > to) return false;
  return true;
}

function actionKind(id) {
  if (id.startsWith("move-") || id.startsWith("route:")) return "move";
  if (id.startsWith("item-action:")) return "item";
  if (id.startsWith("stage-view:")) return "stageView";
  return "world";
}

function hasValue(collection, value) {
  if (!collection || !value) return false;
  if (collection instanceof Set) return collection.has(value);
  if (Array.isArray(collection)) return collection.includes(value);
  return Boolean(collection[value]);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value) return [String(value)];
  return [];
}

function choiceId(label, index) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `choice-${index + 1}`;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
