import { existsSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FLAG_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i;
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
      when: normalizeViewWhen(view.when),
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
    validateViewWhen(view.when, `${base}.when`, add);
  }
}

/** Shared with the client runtime model for location view conditions. */
export function normalizeViewWhen(value) {
  if (!value || typeof value !== "object") return null;
  const all = stringList(value.all ?? value.flags?.all);
  const any = stringList(value.any ?? value.flags?.any);
  const not = stringList(value.not ?? value.flags?.not);
  const stationPower = normalizeStationPower(
    value.stationPower ?? value.facility?.online ?? value.facility?.["hydro.online"],
  );
  const roomLights = normalizeRoomLights(value.roomLights ?? value.lights);
  const passage = text(value.passage?.id ?? value.passage);
  const openRaw = value.passage && typeof value.passage === "object" && "open" in value.passage
    ? value.passage.open
    : value.open;
  const open = typeof openRaw === "boolean" ? openRaw : null;
  if (!all.length && !any.length && !not.length && !stationPower && !roomLights && !passage) return null;
  return {
    ...(all.length ? { all } : {}),
    ...(any.length ? { any } : {}),
    ...(not.length ? { not } : {}),
    ...(stationPower ? { stationPower } : {}),
    ...(roomLights ? { roomLights } : {}),
    ...(passage ? { passage, open: open === null ? true : open } : {}),
  };
}

function validateViewWhen(when, path, add) {
  if (!when) return;
  for (const [group, ids] of [
    ["all", when.all ?? []],
    ["any", when.any ?? []],
    ["not", when.not ?? []],
  ]) {
    for (const [index, id] of ids.entries()) {
      if (!FLAG_PATTERN.test(id)) {
        add(`${path}.${group}.${index}`, "Use a flag id (letters, numbers, dots, hyphens, underscores).");
      }
    }
  }
  if (when.stationPower && when.stationPower !== "online" && when.stationPower !== "offline") {
    add(`${path}.stationPower`, 'Use "online", "offline", or leave blank.');
  }
  if (when.roomLights && when.roomLights !== "on" && when.roomLights !== "off") {
    add(`${path}.roomLights`, 'Use "on", "off", or leave blank.');
  }
  if (when.passage) {
    if (!ID_PATTERN.test(when.passage)) {
      add(`${path}.passage`, "Use a kebab-case passage id.");
    }
    if (typeof when.open !== "boolean") {
      add(`${path}.open`, "Set open to true or false when a passage condition is used.");
    }
  } else if (typeof when.open === "boolean") {
    add(`${path}.passage`, "Passage id is required when open/closed is set.");
  }
}

export function normalizePublicAssetPath(value) {
  return text(value).replace(/^\/+/, "").replace(/^\.?\//, "");
}

function normalizeStationPower(value) {
  if (value === true || value === "online" || value === "on") return "online";
  if (value === false || value === "offline" || value === "off") return "offline";
  return null;
}

function normalizeRoomLights(value) {
  if (value === true || value === "on" || value === "lit") return "on";
  if (value === false || value === "off" || value === "dark") return "off";
  return null;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(entry)).filter(Boolean);
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
