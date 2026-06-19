import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { openDatabase } from "./db.js";
import { StoryRepository } from "./story-repository.js";
import { loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository } from "./world-repository.js";
import { BuildingRepository, UTILITY_STATION_ID } from "./building-repository.js";
import { exportBuildingYaml, parseBuildingYaml } from "./building-yaml.js";

const [command, ...args] = process.argv.slice(2);
const flags = new Set(args.filter((item) => item.startsWith("--")));
const positional = args.filter((item) => !item.startsWith("--"));
const db = openDatabase();

try {
  const seedBuilding = loadBuildingData();
  const worldRepository = new WorldRepository(db, {
    seedWorld: loadWorldSeed(),
    buildingData: seedBuilding,
  });
  const storyRepository = new StoryRepository(db, worldRepository.getCatalog());
  worldRepository.setStoryRepository(storyRepository);
  const repository = new BuildingRepository(db, {
    seedBuilding: command === "import" ? null : seedBuilding,
    worldRepository,
    storyRepository,
  });

  if (command === "import") {
    const file = positional[0];
    if (!file) throw new Error("Usage: npm run building:import -- <building.yaml> [--replace]");
    const building = parseBuildingYaml(readFileSync(resolve(file), "utf8"));
    const result = repository.importBuilding(building, { replace: flags.has("--replace") });
    console.log(`Imported ${result.building.id} version ${result.version}.`);
  } else if (command === "export") {
    const buildingId = positional[0] ?? UTILITY_STATION_ID;
    const output = resolve(positional[1] ?? "content/world/utility-station.export.yaml");
    const result = repository.getDocument(buildingId);
    if (!result) throw new Error(`Building "${buildingId}" is not initialized.`);
    writeFileSync(output, exportBuildingYaml(result.building));
    console.log(`Exported ${buildingId} to ${output}.`);
  } else {
    throw new Error(
      "Usage: building-cli.js import <building.yaml> [--replace] | export [utility-station] [output]",
    );
  }
} finally {
  db.close();
}
