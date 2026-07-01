import { handleCharacterRoutes } from "./api-character-routes.js";
import { handleLearningRoutes } from "./api-learning-routes.js";
import { handleRuntimeRoutes } from "./api-runtime-routes.js";
import { handleStoryRoutes } from "./api-story-routes.js";
import { json } from "./api-utils.js";
import { handleWorldRoutes } from "./api-world-routes.js";
import { writeRuntimeContent } from "./runtime-content-writer.js";

export function createApiHandler(
  repository,
  worldRepository,
  buildingRepository = null,
  characterRepository = null,
  learningRepository = null,
  { syncRuntimeContentOnMutation = false } = {},
) {
  const clients = new Set();
  characterRepository?.setIntegrationValidator?.((character) => {
    const story = repository.validateAgainstCharacter?.(character) ?? {
      valid: true,
      errors: {},
    };
    const buildingDocument = buildingRepository?.getDocument?.();
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

  function broadcast(event, payload) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const response of clients) response.write(message);
  }

  function syncRuntimeContent() {
    if (!syncRuntimeContentOnMutation || !buildingRepository || !characterRepository || !learningRepository) {
      return;
    }
    writeRuntimeContent({
      storyRepository: repository,
      worldRepository,
      buildingRepository,
      characterRepository,
      learningRepository,
    });
  }

  const routeContext = {
    repository,
    worldRepository,
    buildingRepository,
    characterRepository,
    learningRepository,
    clients,
    broadcast,
    syncRuntimeContent,
  };
  const routeHandlers = [
    handleRuntimeRoutes,
    handleLearningRoutes,
    handleCharacterRoutes,
    handleWorldRoutes,
    handleStoryRoutes,
  ];

  async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/")) return false;

    try {
      for (const route of routeHandlers) {
        if (await route(req, res, url, routeContext)) return true;
      }
      return json(res, 404, { message: "API route not found." });
    } catch (error) {
      const status = error.status ?? 500;
      if (status === 500) console.error(error);
      return json(res, status, {
        message: error.message ?? "Unexpected server error.",
        errors: error.errors,
        current: error.current,
      });
    }
  }

  return { handle, close: () => clients.forEach((response) => response.end()) };
}
