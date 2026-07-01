import { BuildingRepository } from "./building-repository.js";
import { CharacterRepository } from "./character-repository.js";
import { LearningRepository } from "./learning-repository.js";
import { learningSeed } from "./learning-seed.js";
import { StoryRepository } from "./story-repository.js";
import { WorldRepository } from "./world-repository.js";

export function createContentRepositories(db) {
  const characterRepository = new CharacterRepository(db);
  const learningRepository = new LearningRepository(db, {
    characterRepository,
    seedLearning: learningSeed,
  });
  const worldRepository = new WorldRepository(db);
  const buildingRepository = new BuildingRepository(db, {
    worldRepository,
    characterRepository,
  });
  const authoredBuilding = buildingRepository.getDocument()?.building ?? null;
  if (authoredBuilding) worldRepository.setBuildingData(authoredBuilding);
  const storyRepository = new StoryRepository(
    db,
    worldRepository.getCatalog(authoredBuilding),
    characterRepository.getDocument()?.character,
    learningRepository.getDocument()?.learning,
  );
  worldRepository.setStoryRepository(storyRepository);
  buildingRepository.setRepositories({
    worldRepository,
    storyRepository,
    characterRepository,
  });
  learningRepository.setCharacterRepository(characterRepository);
  storyRepository.setLearning(learningRepository.getDocument()?.learning);
  return {
    storyRepository,
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
  };
}

export function assertContentDocuments({
  storyRepository,
  worldRepository,
  buildingRepository,
  characterRepository,
  learningRepository,
}) {
  const missing = [];
  if (!storyRepository.listAreas().length) missing.push("story areas");
  if (!worldRepository.getDocument()) missing.push("outdoor world");
  if (!buildingRepository.getDocument()) missing.push("utility station building");
  if (!characterRepository.getDocument()) missing.push("character content");
  if (!learningRepository.getDocument()) missing.push("learning content");
  if (missing.length) {
    throw new Error(
      `SQLite content is incomplete: missing ${missing.join(", ")}. Import a snapshot or restore game/content/atomic-adventures.sqlite.`,
    );
  }
}
