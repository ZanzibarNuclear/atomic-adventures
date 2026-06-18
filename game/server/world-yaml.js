import yaml from "js-yaml";

export function parseWorldYaml(text) {
  const result = yaml.load(text);
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("World YAML must contain one map document.");
  }
  return result;
}

export function exportWorldYaml(world) {
  return yaml.dump(world, {
    noRefs: true,
    lineWidth: 100,
    noCompatMode: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}
