import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "./db.js";
import { loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository, OUTDOOR_WORLD_ID } from "./world-repository.js";
import { exportWorldYaml, parseWorldYaml } from "./world-yaml.js";
import { StoryRepository } from "./story-repository.js";

const [command, ...args] = process.argv.slice(2);
const flags = new Set(args.filter((item) => item.startsWith("--")));
const positional = args.filter((item) => !item.startsWith("--"));
const db = openDatabase();

try {
  const repository = new WorldRepository(db, {
    seedWorld: command === "import" ? null : loadWorldSeed(),
    buildingData: loadBuildingData(),
  });
  const storyRepository = new StoryRepository(db, repository.getCatalog());
  repository.setStoryRepository(storyRepository);
  if (command === "import") {
    const file = positional[0];
    if (!file) throw new Error("Usage: npm run world:import -- <map.yaml> [--replace]");
    const world = parseWorldYaml(readFileSync(resolve(file), "utf8"));
    const result = repository.importWorld(world, { replace: flags.has("--replace") });
    console.log(`Imported ${OUTDOOR_WORLD_ID} version ${result.version}.`);
  } else if (command === "export") {
    const worldId = positional[0] ?? OUTDOOR_WORLD_ID;
    if (worldId !== OUTDOOR_WORLD_ID) throw new Error(`Unknown world document "${worldId}".`);
    const output = resolve(positional[1] ?? "content/world/map.export.yaml");
    const result = repository.getDocument();
    if (!result) throw new Error("Outdoor world is not initialized.");
    writeFileSync(output, exportWorldYaml(result.world));
    console.log(`Exported ${worldId} to ${output}.`);
  } else {
    throw new Error("Usage: world-cli.js import <map.yaml> [--replace] | export [outdoor-main] [output]");
  }
} finally {
  db.close();
}
