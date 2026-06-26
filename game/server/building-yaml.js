import yaml from "js-yaml";

export function parseBuildingYaml(text) {
  const result = yaml.load(text);
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Building YAML must contain one building document.");
  }
  return result;
}

export function exportBuildingYaml(building) {
  return yaml.dump(building, {
    noRefs: true,
    lineWidth: 100,
    noCompatMode: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}
