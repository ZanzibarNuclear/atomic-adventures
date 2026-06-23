import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.js";
import { assertContentDocuments, createContentRepositories } from "./content-repositories.js";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, "..", "public", "content");
const db = openDatabase();

try {
  const {
    storyRepository,
    worldRepository,
    buildingRepository,
    characterRepository,
  } = createContentRepositories(db);
  assertContentDocuments({
    storyRepository,
    worldRepository,
    buildingRepository,
    characterRepository,
  });
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
  console.log(`Exported production runtime content to ${outputDir}.`);
} finally {
  db.close();
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
