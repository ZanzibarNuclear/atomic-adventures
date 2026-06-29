import yaml from "js-yaml";
import { beatToRuntime } from "./story-model.js";

export function parseStoryYaml(text) {
  return yaml.load(text);
}

export function exportAreaYaml(area, beats) {
  const data = {
    area: area.id,
    name: area.name,
    milestones: area.milestones ?? [],
    beats: Object.fromEntries(beats.map((beat) => [beat.id, beatToRuntime(beat)])),
  };
  return yaml.dump(data, {
    noRefs: true,
    lineWidth: 100,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

export function exportBeatYaml(beat) {
  return yaml.dump({ [beat.id]: beatToRuntime(beat) }, {
    noRefs: true,
    lineWidth: 100,
    sortKeys: false,
  });
}
