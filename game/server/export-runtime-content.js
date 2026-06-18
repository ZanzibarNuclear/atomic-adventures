import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.js";
import { StoryRepository } from "./story-repository.js";
import { loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository } from "./world-repository.js";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, "..", "public", "content");
const db = openDatabase();

try {
  const buildingData = loadBuildingData();
  const worldRepository = new WorldRepository(db, {
    seedWorld: loadWorldSeed(),
    buildingData,
  });
  const storyRepository = new StoryRepository(db, worldRepository.getCatalog());
  const worldDocument = worldRepository.getDocument();
  if (!worldDocument) throw new Error("Outdoor world content is not initialized.");

  mkdirSync(outputDir, { recursive: true });
  writeJson(join(outputDir, "story.json"), storyRepository.getRuntimeStory());
  writeJson(join(outputDir, "world.json"), {
    world: worldDocument.world,
    version: worldDocument.version,
    revision: worldDocument.revision,
    warnings: worldRepository.validate(worldDocument.world).warnings,
  });
  console.log(`Exported production runtime content to ${outputDir}.`);
} finally {
  db.close();
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
