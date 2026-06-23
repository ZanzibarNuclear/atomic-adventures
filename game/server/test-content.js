import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, DEFAULT_DB_PATH } from "./db.js";
import { createContentRepositories } from "./content-repositories.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDbPath = join(here, "..", "content", "atomic-adventures.sqlite");

export function copyContentDatabase(path) {
  copyFileSync(fixtureDbPath, path);
}

export function openContentDatabaseCopy(path) {
  copyContentDatabase(path);
  return openDatabase(path);
}

export function loadContentDocuments(path = DEFAULT_DB_PATH) {
  const db = openDatabase(path);
  try {
    const {
      worldRepository,
      buildingRepository,
      characterRepository,
    } = createContentRepositories(db);
    return {
      world: worldRepository.getDocument()?.world,
      building: buildingRepository.getDocument()?.building,
      character: characterRepository.getDocument()?.character,
    };
  } finally {
    db.close();
  }
}
