const DEFAULT_ARC_ID = "part-i-opener";

export function normalizeStoryArcContent(input = {}, { storyData = null } = {}) {
  const source = input ?? {};
  const proseBeats = storyData?.beats ?? {};
  const arcs = Array.isArray(source.storyArcs) ? source.storyArcs : [];
  const ambientScenes = mergeScenesById([
    ...normalizeAmbientScenes(source.ambientScenes),
    ...ambientScenesFromProseBeats(proseBeats),
  ]);

  return {
    id: text(source.id) || "story-main",
    ambientScenes,
    storyArcs: arcs.map((arc, index) => normalizeStoryArc(arc, index, proseBeats)),
  };
}

export function normalizeStoryArc(source = {}, index = 0, proseBeats = {}) {
  const rawBeats = Array.isArray(source.beats) ? source.beats : [];
  const id = text(source.id) || `${DEFAULT_ARC_ID}-${index + 1}`;
  const startBeat = text(source.startBeat) || text(rawBeats[0]?.id) || null;

  return {
    ...source,
    id,
    title: text(source.title) || id,
    protagonist: text(source.protagonist) || null,
    startBeat,
    beats: rawBeats.map((beat, beatIndex) => normalizeStoryBeat(beat, beatIndex, proseBeats)),
    completion: normalizeArcCompletion(source.completion),
  };
}

function normalizeArcCompletion(source = {}) {
  if (!source || typeof source !== "object") return null;
  const card = source.card && typeof source.card === "object"
    ? {
      eyebrow: text(source.card.eyebrow),
      heading: text(source.card.heading),
      description: text(source.card.description),
      note: text(source.card.note),
      actionLabel: text(source.card.actionLabel),
    }
    : null;
  return {
    nextArc: text(source.nextArc) || null,
    // Optional merge target on the next arc (defaults to that arc's startBeat).
    nextBeat: text(source.nextBeat) || null,
    card,
  };
}

export function normalizeStoryBeat(source = {}, index = 0, proseBeats = {}) {
  const { nextArc: _ignoredLegacyArcHandoff, ...beatSource } = source;
  const proseBeatId = text(source.scene);
  const proseBeat = proseBeatId ? proseBeats[proseBeatId] : null;
  const id = text(source.id) || `story-beat-${index + 1}`;
  const linkedScenes = Object.entries(proseBeats)
    .filter(([sceneId, beat]) => sceneId !== proseBeatId && beat?.storyBeat === id)
    .map(([sceneId, beat]) => sceneFromProseBeat(sceneId, beat));
  // Empty scenes [] must not block re-linking prose when this runs again with storyData
  // (useStoryArcContent normalizes once without beats; GameView normalizes again with them).
  const hasScenes = Array.isArray(source.scenes) && source.scenes.length > 0;
  const scenes = hasScenes
    ? source.scenes
    : proseBeat
      ? [sceneFromProseBeat(proseBeatId, proseBeat), ...linkedScenes]
      : linkedScenes;
  const choices = Array.isArray(source.choices) && source.choices.length
    ? source.choices
    : Array.isArray(proseBeat?.choices)
      ? proseBeat.choices
      : [];

  const normalizedChoices = choices.map((choice, choiceIndex) => normalizeChoice(choice, choiceIndex));

  return {
    ...beatSource,
    id,
    title: text(source.title) || id,
    scenes: scenes.map((scene, sceneIndex) =>
      normalizeScene(scene, sceneIndex, {
        proseBeats,
        defaultSceneId: proseBeatId,
        defaultChoices: normalizedChoices,
      })
    ),
    choices: normalizedChoices,
    authoredActions: normalizeAuthoredActions(source.authoredActions, source.allowed),
    completesWhen: source.completesWhen ?? source.completionCondition ?? null,
    onEnter: source.onEnter ?? null,
    onComplete: source.onComplete ?? null,
    next: text(source.next) || null,
  };
}

export function normalizeScene(source = {}, index = 0, context = {}) {
  const id = text(source.id) || text(source.sceneId) || `scene-${index + 1}`;
  const proseBeat = context.proseBeats?.[id] ?? null;
  const choices = Array.isArray(source.choices) && source.choices.length
    ? source.choices
    : Array.isArray(proseBeat?.choices)
      ? proseBeat.choices
      : id === context.defaultSceneId
        ? context.defaultChoices ?? []
        : [];
  return {
    ...source,
    id,
    trigger: source.trigger ?? proseBeat?.trigger ?? {},
    conditions: source.conditions ?? proseBeat?.conditions ?? null,
    modes: normalizeStringArray(source.modes?.length ? source.modes : proseBeat?.modes),
    match: source.match ?? proseBeat?.match ?? {},
    time: source.time ?? proseBeat?.time ?? {},
    eyebrow: text(source.eyebrow) || text(proseBeat?.eyebrow),
    heading: text(source.heading) || text(proseBeat?.heading),
    prose: text(source.prose) || text(source.text) || text(proseBeat?.text),
    revisitProse: text(source.revisitProse) || text(source.revisit) || text(proseBeat?.revisit),
    choices: choices.map((choice, choiceIndex) => normalizeChoice(choice, choiceIndex)),
  };
}

export function selectSceneForBeat(beat, context = {}) {
  const scenes = Array.isArray(beat?.scenes) ? beat.scenes : [];
  return selectBestScene(scenes, context);
}

export function selectAmbientSceneForArc(arc, context = {}, extraScenes = []) {
  const beats = Array.isArray(arc?.beats) ? arc.beats : [];
  const sceneEntries = [
    ...beats.flatMap((beat, beatIndex) =>
      (Array.isArray(beat?.scenes) ? beat.scenes : []).map((scene) => ({
        scene,
        beatId: beat.id,
        beatIndex,
      }))
    ),
    ...extraScenes.map((scene, index) => ({
      scene,
      beatId: null,
      beatIndex: beats.length + index,
    })),
  ];
  let selected = null;
  let selectedScore = -1;

  for (const { scene, beatId, beatIndex } of sceneEntries) {
    const match = selectBestScene([scene], context);
    if (!match) continue;
    const score = sceneSelectionScore(scene, context) + ambientOrderScore(beatIndex, sceneEntries.length);
    if (score < 0 || score <= selectedScore) continue;
    selected = {
      ...match,
      ambient: true,
      storyBeatId: beatId,
    };
    selectedScore = score;
  }

  return selected;
}

function ambientScenesFromProseBeats(proseBeats = {}) {
  return Object.entries(proseBeats)
    .filter(([, beat]) => !text(beat?.storyBeat))
    .map(([sceneId, beat]) => sceneFromProseBeat(sceneId, beat));
}

function normalizeAmbientScenes(scenes) {
  if (!Array.isArray(scenes)) return [];
  return scenes.map((scene, index) => normalizeScene(scene, index));
}

function mergeScenesById(scenes = []) {
  const merged = new Map();
  for (const scene of scenes) {
    if (!scene?.id) continue;
    merged.set(scene.id, scene);
  }
  return [...merged.values()];
}

function selectBestScene(scenes, context = {}) {
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
    const score = matchScore(scene, loc, action)
      + timeScore(scene)
      + flagScore(scene)
      + locationSpecificityScore(scene);
    if (score < 0 || score <= selectedScore) continue;
    selected = scene;
    selectedScore = score;
  }

  return selected;
}

/** Prefer stand-scoped scenes over room-wide ones when both match. */
function locationSpecificityScore(scene) {
  const trigger = scene.trigger ?? {};
  let score = 0;
  if (trigger.hex) score += 1;
  if (trigger.room) score += 1;
  if (trigger.stand) score += 2;
  if (trigger.exteriorNode) score += 2;
  if (trigger.event) score += 3;
  return score;
}

export function sceneSelectionScore(scene, context = {}) {
  if (!scene) return -1;
  if (!triggerMatches(scene, context.location ?? {}, context.event ?? null)) return -1;
  if (!modeMatches(scene, context)) return -1;
  if (!timeMatches(scene, context)) return -1;
  if (!flagMatches(scene, context)) return -1;
  const loc = context.location ?? {};
  const event = context.event ?? null;
  const action = context.actionContext ?? sceneActionContext(loc, event);
  const score = matchScore(scene, loc, action)
    + timeScore(scene)
    + flagScore(scene)
    + locationSpecificityScore(scene);
  return score < 0 ? -1 : score;
}

/**
 * Prefer the more location-specific match (e.g. stand over room) when both are eligible.
 */
export function preferMoreSpecificScene(primary, alternate, context = {}) {
  if (!primary) return alternate ?? null;
  if (!alternate) return primary;
  const primaryScore = sceneSelectionScore(primary, context);
  const alternateScore = sceneSelectionScore(alternate, context);
  if (alternateScore > primaryScore) return alternate;
  return primary;
}

function ambientOrderScore(index, total) {
  return total > 0 ? (total - index) / (total + 1) : 0;
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
    conditions: beat.conditions ?? null,
    modes: beat.modes ?? [],
    match: beat.match ?? {},
    time: beat.time ?? {},
    prose: beat.text ?? "",
    revisitProse: beat.revisit ?? "",
    eyebrow: beat.eyebrow,
    heading: beat.heading,
    storyBeat: beat.storyBeat,
    choices: beat.choices ?? [],
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
  // Stand refines a room. Room-only scenes match any stand; stand scenes need exact stand.
  if (trigger.stand) {
    if (loc.place !== "indoors" || trigger.stand !== loc.stand) return false;
  }
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
  const requiredFlags = normalizeStringArray(conditions.flags?.all ?? conditions.flags);
  const absentFlags = normalizeStringArray(conditions.flags?.not);
  if (requiredFlags.some((flag) => !hasValue(flags, flag))) return false;
  if (absentFlags.some((flag) => hasValue(flags, flag))) return false;
  return true;
}

function flagScore(scene) {
  const conditions = scene.conditions ?? {};
  let score = 0;
  if (scene.trigger?.flag) score += 1;
  if (conditions.flag) score += 1;
  score += normalizeStringArray(conditions.flags?.all ?? conditions.flags).length;
  score += normalizeStringArray(conditions.flags?.not).length;
  return score;
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
  if (time.afterMilestone && !hasMilestoneOrFlag(context, time.afterMilestone)) return false;
  if (time.beforeMilestone && hasMilestoneOrFlag(context, time.beforeMilestone)) return false;
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

function hasMilestoneOrFlag(context, value) {
  return hasValue(context.milestones, value) || hasValue(context.flags, value);
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
