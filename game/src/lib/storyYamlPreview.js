import yaml from "js-yaml";

export function storyBeatYaml(beat) {
  if (!beat?.id) return "";
  const output = {
    once: beat.once,
    acknowledge: beat.acknowledge,
    eyebrow: optional(beat.eyebrow),
    heading: optional(beat.heading),
    trigger: compact(beat.trigger),
    require: compactDeep(beat.require),
    text: beat.text ?? "",
    revisit: optional(beat.revisit),
    choices: (beat.choices ?? []).map((choice) => compact({
      text: choice.text,
      require: compactDeep(choice.require),
      effects: list(choice.effects),
      timeMinutes: choice.timeMinutes || undefined,
      activity: choice.timeMinutes ? choice.activity : undefined,
      sets: list(choice.sets),
      set_flags: list(choice.set_flags),
      go_hex: optional(choice.go_hex),
      go_room: optional(choice.go_room),
      enter: optional(choice.enter),
    })),
  };
  return yaml.dump({ [beat.id]: compact(output) }, {
    noRefs: true,
    lineWidth: 100,
    sortKeys: false,
  });
}

function compact(value = {}) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ""),
  );
}

function compactLists(value = {}) {
  const result = {};
  for (const key of ["all", "any", "not"]) {
    const items = list(value[key]);
    if (items?.length) result[key] = items;
  }
  return Object.keys(result).length ? result : undefined;
}

function compactDeep(value) {
  if (Array.isArray(value)) {
    const result = value.map(compactDeep).filter((item) => item !== undefined);
    return result.length ? result : undefined;
  }
  if (!value || typeof value !== "object") {
    return value === "" || value == null ? undefined : value;
  }
  const result = Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, compactDeep(item)])
      .filter(([, item]) => item !== undefined),
  );
  return Object.keys(result).length ? result : undefined;
}

function list(value) {
  return Array.isArray(value) && value.length ? value : undefined;
}

function optional(value) {
  return value || undefined;
}
