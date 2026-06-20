import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "./db.js";
import { StoryRepository } from "./story-repository.js";
import { loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository } from "./world-repository.js";
import { exportAreaYaml, parseStoryYaml } from "./story-yaml.js";
import { loadCharacterSeed } from "./character-catalog.js";
import { CharacterRepository } from "./character-repository.js";

const [command, fileArg, ...flags] = process.argv.slice(2);
const db = openDatabase();
const worldRepository = new WorldRepository(db, {
  seedWorld: loadWorldSeed(),
  buildingData: loadBuildingData(),
});
const characterRepository = new CharacterRepository(db, {
  seedCharacter: loadCharacterSeed(),
});
const repository = new StoryRepository(
  db,
  worldRepository.getCatalog(),
  characterRepository.getDocument()?.character,
);

try {
  if (command === "import") {
    if (!fileArg) throw new Error("Usage: npm run content:import -- <story.yaml> [--replace]");
    const data = parseStoryYaml(readFileSync(resolve(fileArg), "utf8"));
    repository.importArea(data, { replace: flags.includes("--replace") });
    console.log(`Imported story area "${data.area}".`);
  } else if (command === "export") {
    const areaId = fileArg ?? repository.listAreas()[0]?.id;
    if (!areaId) throw new Error("No story area is available to export.");
    const area = repository.listAreas().find((item) => item.id === areaId);
    if (!area) throw new Error(`Unknown story area "${areaId}".`);
    const output = resolve(flags.find((item) => !item.startsWith("--")) ?? `content/story/${areaId}.export.yaml`);
    writeFileSync(output, exportAreaYaml(area, repository.listBeats(areaId, { full: true })));
    console.log(`Exported "${areaId}" to ${output}.`);
  } else {
    throw new Error("Usage: content-cli.js import <file> [--replace] | export [area] [output]");
  }
} finally {
  db.close();
}
