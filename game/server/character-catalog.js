import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "content", "character", "character-main.yaml");

export function loadCharacterSeed() {
  return yaml.load(readFileSync(seedPath, "utf8"));
}
