import { existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const ALLOWED_FOLDERS = new Set(["items", "characters", "views"]);

const publicRoot = join(fileURLToPath(new URL("..", import.meta.url)), "public");

export function listPublicImages(folder) {
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new Error(`Unknown public asset folder "${folder}".`);
  }
  const directory = join(publicRoot, folder);
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => `${folder}/${entry.name}`)
    .sort((left, right) => left.localeCompare(right));
}
