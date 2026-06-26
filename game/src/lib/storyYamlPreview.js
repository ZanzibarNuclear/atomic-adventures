import yaml from "js-yaml";

export function storyBeatYaml(beat) {
  if (!beat?.id) return "";
  const match = compact(beat.match);
  const output = {
    eyebrow: optional(beat.eyebrow),
    heading: optional(beat.heading),
    trigger: compact(beat.trigger),
    match: Object.keys(match).length ? match : undefined,
    text: beat.text ?? "",
    revisit: optional(beat.revisit),
    choices: (beat.choices ?? []).map((choice) => compact({
      text: choice.text,
      timeMinutes: choice.timeMinutes || undefined,
      activity: choice.timeMinutes ? choice.activity : undefined,
      sets: list(choice.sets),
      set_flags: list(choice.set_flags),
      go_hex: optional(choice.go_hex),
      go_room: optional(choice.go_room),
      go_exterior_node: optional(choice.go_exterior_node),
      enter: optional(choice.enter),
      view: choice.view || undefined,
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

function list(value) {
  return Array.isArray(value) && value.length ? value : undefined;
}

function optional(value) {
  return value || undefined;
}
