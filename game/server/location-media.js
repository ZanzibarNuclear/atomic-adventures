import { existsSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const publicRoot = fileURLToPath(new URL("../public", import.meta.url));

export function normalizeLocationViews(owner) {
  if (!owner || typeof owner !== "object") return;
  if (!Array.isArray(owner.views)) {
    delete owner.views;
    return;
  }
  owner.views = owner.views
    .filter((view) => view && typeof view === "object")
    .map((view) => ({
      id: text(view.id),
      kind: text(view.kind) || "image",
      src: normalizePublicAssetPath(view.src),
      label: text(view.label),
      alt: text(view.alt),
    }));
  if (!owner.views.length) delete owner.views;
}

export function validateLocationViews(owner, path, add, warn) {
  normalizeLocationViews(owner);
  const ids = new Set();
  for (const [index, view] of (owner?.views ?? []).entries()) {
    const base = `${path}.views.${index}`;
    if (!ID_PATTERN.test(view.id)) add(`${base}.id`, "Use a unique kebab-case view ID.");
    if (ids.has(view.id)) add(`${base}.id`, "View IDs must be unique within this location.");
    ids.add(view.id);
    if (view.kind !== "image") add(`${base}.kind`, "Only image location views are supported.");
    if (!view.src) {
      add(`${base}.src`, "Choose an image under game/public/views.");
    } else if (!isViewsAssetPath(view.src)) {
      add(`${base}.src`, "Location view images must use a views/... public asset path.");
    } else if (!IMAGE_EXTENSIONS.has(extname(view.src).toLowerCase())) {
      add(`${base}.src`, "Location view images must use a supported image extension.");
    } else if (!publicAssetExists(view.src)) {
      warn(`${base}.src`, `Image "${view.src}" was not found under game/public.`);
    }
    if (!view.alt) warn(`${base}.alt`, "Add alt text before production release.");
  }
}

export function normalizePublicAssetPath(value) {
  return text(value).replace(/^\/+/, "").replace(/^\.?\//, "");
}

function isViewsAssetPath(value) {
  if (!value || value.includes("\0")) return false;
  if (/^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("data:")) return false;
  if (!value.startsWith("views/")) return false;
  const normalized = normalize(value);
  return normalized === value && !normalized.split(sep).includes("..");
}

function publicAssetExists(value) {
  return existsSync(join(publicRoot, value));
}

function text(value) {
  return String(value ?? "").trim();
}
