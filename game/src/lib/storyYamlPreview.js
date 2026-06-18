import yaml from "js-yaml";

export function storyBeatYaml(beat) {
  if (!beat?.id) return "";
  const output = {
    once: beat.once,
    acknowledge: beat.acknowledge,
    eyebrow: optional(beat.eyebrow),
    heading: optional(beat.heading),
    trigger: compact(beat.trigger),
    require: compactLists(beat.require),
    text: beat.text ?? "",
    revisit: optional(beat.revisit),
    choices: (beat.choices ?? []).map((choice) => compact({
      text: choice.text,
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

function list(value) {
  return Array.isArray(value) && value.length ? value : undefined;
}

function optional(value) {
  return value || undefined;
}
