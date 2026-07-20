const PLAY_MODES = ["story", "open-world"];
const STORY_SCOPE_ANY = "*";

export function buildStoryBeatMatchWarnings(beats, { locationMode, selectedLocation } = {}) {
  const groups = new Map();
  for (const beat of beats ?? []) {
    const origin = originHexLabel(beat.match?.originHex);
    const mapTransition = beat.match?.mapTransition ?? "";
    const direction = beat.match?.transitionDirection ?? "";
    const time = timeCriteriaParts(beat.time).join(":");
    const flags = flagCriteriaParts(beat.conditions).join(":");
    const key = `${locationMode}:${selectedLocation}:origin=${origin}:mapTransition=${mapTransition}:direction=${direction}:time=${time}:flags=${flags}`;
    const group = groups.get(key) ?? [];
    group.push(beat);
    groups.set(key, group);
  }

  return [...groups.values()]
    .flatMap((group) => overlappingModeGroups(group))
    .filter((group) => group.length > 1)
    .map((group) => {
      const origin = originHexLabel(group[0].match?.originHex);
      const mapTransition = group[0].match?.mapTransition;
      const direction = group[0].match?.transitionDirection;
      const label = [
        origin ? `origin ${origin}` : "",
        mapTransition ? `map transition ${mapTransition}` : "",
        direction ? (direction === "toLocal" ? "to local map" : "to regional map") : "",
        timeCriteriaLabel(group[0].time),
        flagCriteriaLabel(group[0].conditions),
      ].filter(Boolean).join(", ") || "default/no origin or map transition";
      return `Multiple beats use ${label}: ${group.map((beat) => beat.id).join(", ")}. The first sorted beat wins.`;
    });
}

export function originHexLabel(value) {
  const origins = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : value
        ? [value]
        : [];
  return origins.join("|");
}

function overlappingModeGroups(beats) {
  const warningGroups = [];
  const visited = new Set();
  for (let index = 0; index < beats.length; index += 1) {
    if (visited.has(index)) continue;
    const indexes = new Set([index]);
    let changed = true;
    while (changed) {
      changed = false;
      for (let candidateIndex = 0; candidateIndex < beats.length; candidateIndex += 1) {
        if (indexes.has(candidateIndex)) continue;
        const candidate = beats[candidateIndex];
        const overlapsGroup = [...indexes].some((groupIndex) =>
          modeCriteriaOverlap(beats[groupIndex], candidate),
        );
        if (!overlapsGroup) continue;
        indexes.add(candidateIndex);
        changed = true;
      }
    }
    if (indexes.size <= 1) continue;
    indexes.forEach((item) => visited.add(item));
    warningGroups.push([...indexes].map((item) => beats[item]));
  }
  return warningGroups;
}

function modeCriteriaOverlap(left, right) {
  return [...modeEligibility(left)].some((leftScope) =>
    [...modeEligibility(right)].some((rightScope) => scopesOverlap(leftScope, rightScope)),
  );
}

function modeEligibility(beat) {
  const authoredModes = Array.isArray(beat.modes)
    ? beat.modes.filter((mode) => PLAY_MODES.includes(mode))
    : [];
  const modes = authoredModes.length ? authoredModes : PLAY_MODES;
  const scopes = new Set();
  if (modes.includes("open-world") && !beat.storyBeat) scopes.add("open-world");
  if (modes.includes("story")) {
    scopes.add(`story:${beat.storyBeat || STORY_SCOPE_ANY}`);
  }
  return scopes;
}

function scopesOverlap(left, right) {
  if (left === right) return true;
  if (!left.startsWith("story:") || !right.startsWith("story:")) return false;
  const leftStep = left.slice("story:".length);
  const rightStep = right.slice("story:".length);
  return leftStep === STORY_SCOPE_ANY || rightStep === STORY_SCOPE_ANY;
}

function timeCriteriaParts(time = {}) {
  const parts = [];
  if (Array.isArray(time.days) && time.days.length) {
    parts.push(`day=${[...time.days].map(Number).filter(Number.isFinite).sort((a, b) => a - b).join("|")}`);
  }
  if (time.dayFrom != null) parts.push(`dayFrom=${time.dayFrom}`);
  if (time.dayTo != null) parts.push(`dayTo=${time.dayTo}`);
  if (time.phase) parts.push(`phase=${time.phase}`);
  if (time.minuteOfDayFrom != null) parts.push(`minuteFrom=${time.minuteOfDayFrom}`);
  if (time.minuteOfDayTo != null) parts.push(`minuteTo=${time.minuteOfDayTo}`);
  if (time.elapsedFrom != null) parts.push(`elapsedFrom=${time.elapsedFrom}`);
  if (time.elapsedTo != null) parts.push(`elapsedTo=${time.elapsedTo}`);
  if (time.afterMilestone) parts.push(`after=${time.afterMilestone}`);
  if (time.beforeMilestone) parts.push(`before=${time.beforeMilestone}`);
  return parts;
}

function flagCriteriaParts(conditions = {}) {
  const flags = conditions?.flags ?? {};
  const parts = [];
  if (Array.isArray(flags.all) && flags.all.length) {
    parts.push(`all=${[...flags.all].sort().join("|")}`);
  }
  if (Array.isArray(flags.not) && flags.not.length) {
    parts.push(`not=${[...flags.not].sort().join("|")}`);
  }
  if (conditions?.flag) parts.push(`flag=${conditions.flag}`);
  return parts;
}

function timeCriteriaLabel(time = {}) {
  const labels = [];
  if (Array.isArray(time.days) && time.days.length) labels.push(`Day #: ${time.days.join(", ")}`);
  if (time.dayFrom != null) labels.push(`Day from: ${time.dayFrom}`);
  if (time.dayTo != null) labels.push(`Day to: ${time.dayTo}`);
  if (time.phase) labels.push(`Time of day: ${time.phase}`);
  if (time.minuteOfDayFrom != null) labels.push(`minute from ${time.minuteOfDayFrom}`);
  if (time.minuteOfDayTo != null) labels.push(`minute to ${time.minuteOfDayTo}`);
  if (time.elapsedFrom != null) labels.push(`elapsed from ${time.elapsedFrom}`);
  if (time.elapsedTo != null) labels.push(`elapsed to ${time.elapsedTo}`);
  if (time.afterMilestone) labels.push(`after ${time.afterMilestone}`);
  if (time.beforeMilestone) labels.push(`before ${time.beforeMilestone}`);
  return labels.join(", ");
}

function flagCriteriaLabel(conditions = {}) {
  const labels = [];
  const flags = conditions?.flags ?? {};
  if (Array.isArray(flags.all) && flags.all.length) labels.push(`requires ${flags.all.join(", ")}`);
  if (Array.isArray(flags.not) && flags.not.length) labels.push(`absent ${flags.not.join(", ")}`);
  if (conditions?.flag) labels.push(`requires ${conditions.flag}`);
  return labels.join(", ");
}
