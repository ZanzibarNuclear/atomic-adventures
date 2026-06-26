import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const RUNTIME_CONTENT_DIR = join(here, "..", "public", "content");

export function writeRuntimeContent({
  storyRepository,
  worldRepository,
  buildingRepository,
  characterRepository,
  outputDir = RUNTIME_CONTENT_DIR,
}) {
  const worldDocument = worldRepository.getDocument();
  const buildingDocument = buildingRepository.getDocument();
  const characterDocument = characterRepository.getRuntimeCharacter();

  mkdirSync(outputDir, { recursive: true });
  writeJson(join(outputDir, "story.json"), storyRepository.getRuntimeStory());
  writeJson(join(outputDir, "world.json"), {
    world: worldDocument.world,
    version: worldDocument.version,
    revision: worldDocument.revision,
    warnings: worldRepository.validate(worldDocument.world).warnings,
  });
  writeJson(join(outputDir, "utility-station.json"), {
    building: buildingDocument.building,
    version: buildingDocument.version,
    revision: buildingDocument.revision,
    warnings: buildingRepository.validate(buildingDocument.building).warnings,
  });
  writeJson(join(outputDir, "character.json"), characterDocument);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
