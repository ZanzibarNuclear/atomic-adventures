import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { openDatabase } from "./db.js";
import { loadCharacterSeed } from "./character-catalog.js";
import { CharacterRepository } from "./character-repository.js";
import { loadBuildingData, loadWorldSeed } from "./world-catalog.js";
import { WorldRepository } from "./world-repository.js";
import { StoryRepository } from "./story-repository.js";
import { BuildingRepository } from "./building-repository.js";

const [command, ...args] = process.argv.slice(2);
const positional = args.filter((item) => !item.startsWith("--"));
const db = openDatabase();

try {
  const repository = new CharacterRepository(db, {
    seedCharacter: loadCharacterSeed(),
  });
  const buildingData = loadBuildingData();
  const worldRepository = new WorldRepository(db, {
    seedWorld: loadWorldSeed(),
    buildingData,
  });
  const storyRepository = new StoryRepository(
    db,
    worldRepository.getCatalog(),
    repository.getDocument()?.character,
  );
  const buildingRepository = new BuildingRepository(db, {
    seedBuilding: buildingData,
    worldRepository,
    storyRepository,
    characterRepository: repository,
  });
  repository.setIntegrationValidator((character) => {
    const story = storyRepository.validateAgainstCharacter(character);
    const buildingDocument = buildingRepository.getDocument();
    const building = buildingDocument
      ? buildingRepository.validate(buildingDocument.building, { character })
      : { valid: true, errors: {}, warnings: [] };
    return {
      valid: story.valid && building.valid,
      errors: {
        ...story.errors,
        ...Object.fromEntries(
          Object.entries(building.errors ?? {})
            .map(([path, messages]) => [`building.${path}`, messages]),
        ),
      },
      warnings: building.warnings ?? [],
    };
  });
  if (command === "import") {
    const file = positional[0];
    if (!file) throw new Error("Usage: npm run character:import -- <character.yaml>");
    const candidate = yaml.load(readFileSync(resolve(file), "utf8"));
    const existing = repository.getDocument();
    const result = repository.save(candidate, existing.version);
    console.log(`Imported character content version ${result.version}.`);
  } else if (command === "export") {
    const output = resolve(positional[0] ?? "content/character/character-main.export.yaml");
    const existing = repository.getDocument();
    if (!existing) throw new Error("Character content is not initialized.");
    writeFileSync(output, yaml.dump(existing.character, { lineWidth: 100 }));
    console.log(`Exported character content to ${output}.`);
  } else {
    throw new Error(
      "Usage: character-cli.js import <character.yaml> | export [output]",
    );
  }
} finally {
  db.close();
}
