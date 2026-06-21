import { json } from "./api-utils.js";
import { publicWorldCatalog } from "./world-catalog.js";

export async function handleRuntimeRoutes(req, res, url, {
  repository,
  worldRepository,
  characterRepository,
  clients,
}) {
  if (req.method === "GET" && url.pathname === "/api/story") {
    return json(res, 200, repository.getRuntimeStory());
  }

  if (req.method === "GET" && url.pathname === "/api/catalog") {
    return json(res, 200, {
      areas: repository.listAreas(),
      world: publicWorldCatalog(worldRepository.getCatalog()),
      character: characterRepository?.getDocument()?.character ?? null,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/content/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`event: ready\ndata: ${JSON.stringify({
      storyRevision: repository.getGlobalRevision(),
      worldRevision: worldRepository.getGlobalRevision(),
      characterRevision: characterRepository?.getGlobalRevision() ?? 0,
    })}\n\n`);
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return true;
  }

  return false;
}
