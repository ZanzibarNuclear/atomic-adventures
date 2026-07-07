import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeStoryArcContent } from "../src/composables/storyArcModel.js";

const here = dirname(fileURLToPath(import.meta.url));
export const RUNTIME_CONTENT_DIR = join(here, "..", "public", "content");

export function writeRuntimeContent({
  storyRepository,
  worldRepository,
  buildingRepository,
  characterRepository,
  learningRepository,
  storyArcRepository,
  outputDir = RUNTIME_CONTENT_DIR,
}) {
  const worldDocument = worldRepository.getDocument();
  const buildingDocument = buildingRepository.getDocument();
  const characterDocument = characterRepository.getRuntimeCharacter();
  const learningDocument = learningRepository.getRuntimeLearning();
  const storyArcSource = storyArcRepository.getRuntimeStoryArcDocument();
  const storyDocument = storyRepository.getRuntimeStory();
  const storyBeats = Object.assign(
    {},
    ...Object.values(storyDocument.areas ?? {}).map((area) => area.beats ?? {}),
  );
  const storyArcDocument = {
    story: normalizeStoryArcContent(storyArcSource.storyArcDocument, {
      storyData: { beats: storyBeats },
    }),
    version: storyArcSource.version,
    revision: storyArcSource.revision,
    warnings: storyArcSource.warnings,
  };

  mkdirSync(outputDir, { recursive: true });
  writeJson(join(outputDir, "story.json"), storyDocument);
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
  writeJson(join(outputDir, "learning.json"), learningDocument);
  writeJson(join(outputDir, "story-arcs.json"), storyArcDocument);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
