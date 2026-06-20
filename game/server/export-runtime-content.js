import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.js";
import { StoryRepository } from "./story-repository.js";
import { loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository } from "./world-repository.js";
import { BuildingRepository } from "./building-repository.js";
import { loadCharacterSeed } from "./character-catalog.js";
import { CharacterRepository } from "./character-repository.js";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, "..", "public", "content");
const db = openDatabase();

try {
  const buildingData = loadBuildingData();
  const worldRepository = new WorldRepository(db, {
    seedWorld: loadWorldSeed(),
    buildingData,
  });
  const characterRepository = new CharacterRepository(db, {
    seedCharacter: loadCharacterSeed(),
  });
  const storyRepository = new StoryRepository(
    db,
    worldRepository.getCatalog(),
    characterRepository.getDocument()?.character,
  );
  const buildingRepository = new BuildingRepository(db, {
    seedBuilding: buildingData,
    worldRepository,
    storyRepository,
    characterRepository,
  });
  const authoredBuilding = buildingRepository.getDocument()?.building ?? buildingData;
  worldRepository.setBuildingData(authoredBuilding);
  storyRepository.setWorld(worldRepository.getCatalog(authoredBuilding));
  const worldDocument = worldRepository.getDocument();
  const buildingDocument = buildingRepository.getDocument();
  if (!worldDocument) throw new Error("Outdoor world content is not initialized.");
  if (!buildingDocument) throw new Error("Utility station content is not initialized.");
  const characterDocument = characterRepository.getRuntimeCharacter();
  if (!characterDocument) throw new Error("Character content is not initialized.");

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
