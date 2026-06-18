import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const storyPath = join(dist, "content", "story.json");
const worldPath = join(dist, "content", "world.json");
const assetsPath = join(dist, "assets");

for (const path of [join(dist, "index.html"), storyPath, worldPath]) {
  if (!existsSync(path)) throw new Error(`Production artifact is missing: ${path}`);
}

const story = JSON.parse(readFileSync(storyPath, "utf8"));
const world = JSON.parse(readFileSync(worldPath, "utf8"));
if (!Object.keys(story.areas ?? {}).length) throw new Error("Production story export has no areas.");
if (!(world.world?.hexes?.length > 0)) throw new Error("Production world export has no hexes.");

const assets = readdirSync(assetsPath);
const builderChunks = assets.filter((name) => /Builder(View|Shell)/.test(name));
if (builderChunks.length) {
  throw new Error(`Builder chunks must not ship to production: ${builderChunks.join(", ")}`);
}

const javascript = assets
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(join(assetsPath, name), "utf8"))
  .join("\n");
for (const forbidden of ["/api/story", "/api/world", "/api/content/events", "new EventSource"]) {
  if (javascript.includes(forbidden)) {
    throw new Error(`Production bundle still references local authoring runtime: ${forbidden}`);
  }
}
for (const required of ["/content/story.json", "/content/world.json"]) {
  if (!javascript.includes(required)) {
    throw new Error(`Production bundle does not reference static runtime content: ${required}`);
  }
}

console.log(
  `Verified production build: ${Object.keys(story.areas).length} story area(s), ` +
    `${world.world.hexes.length} outdoor hexes, no builder chunks or authoring API dependency.`,
);
