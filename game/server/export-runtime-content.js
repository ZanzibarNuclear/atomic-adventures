import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./db.js";
import { assertContentDocuments, createContentRepositories } from "./content-repositories.js";
import { writeRuntimeContent } from "./runtime-content-writer.js";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, "..", "public", "content");
const db = openDatabase();

try {
  const {
    storyRepository,
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
    storyArcRepository,
  } = createContentRepositories(db);
  assertContentDocuments({
    storyRepository,
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
    storyArcRepository,
  });
  writeRuntimeContent({
    storyRepository,
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
    storyArcRepository,
    outputDir,
  });
  console.log(`Exported production runtime content to ${outputDir}.`);
} finally {
  db.close();
}
