/**
 * Display labels for world entities.
 * Optional `label` in data; otherwise kebab-case id → Title Case.
 */

export function humanizeId(id) {
  if (id == null || id === "") return "";
  return String(id)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * @param {string | { id?: string, label?: string } | null | undefined} source
 * @param {string} [fallbackId]
 */
export function displayLabel(source, fallbackId) {
  if (source == null) return humanizeId(fallbackId ?? "");
  if (typeof source === "string") return humanizeId(source);
  const id = source.id ?? fallbackId;
  if (source.label) return source.label;
  return humanizeId(id);
}

export function hexLabel(hex) {
  return displayLabel(hex);
}

export function landmarkLabel(landmark) {
  if (!landmark) return "";
  const id = landmark.building ?? landmark.id;
  return displayLabel(landmark, id);
}

export function roomLabel(room) {
  return displayLabel(room);
}

export function buildingLabel(building) {
  if (!building) return "";
  return displayLabel(building, building.id ?? building.areaId);
}

export function featureLabel(feature) {
  return displayLabel(feature);
}

export function routeLabel(route) {
  return displayLabel(route);
}

export function levelLabel(level) {
  return displayLabel(level);
}

export function exteriorNodeLabel(node) {
  return displayLabel(node);
}

/**
 * Inventory group heading. Named stands use the stand's player-facing name
 * ("On the console"), never the holder id slug ("control-room-console").
 */
export function inventoryHolderHeading(holder, stand = null) {
  const kind = holder?.kind;
  if (kind === "character") return "In your hands";
  if (kind === "world") {
    if (stand || holder?.location?.stand) return "On the floor";
    return holder?.label || "Within reach";
  }
  if (kind === "fixed" || kind === "vehicle") {
    const name = inventorySurfaceName(holder, stand);
    return name ? `On the ${stripLeadingArticle(name)}` : (holder?.label || "Nearby");
  }
  return holder?.label ?? holder?.id ?? "";
}

/** Hide the generic world bucket when a named stand surface already represents that place. */
export function isRedundantWorldHolder(holder, holders = []) {
  if (holder?.kind !== "world") return false;
  if (holder.records?.length) return false;
  return holders.some((entry) => (
    entry.kind === "fixed"
    && entry.location?.stand
    && entry.id !== holder.id
  ));
}

function inventorySurfaceName(holder, stand = null) {
  const short = String(holder?.shortLabel ?? "").trim();
  if (short) return short;
  const standLabel = String(stand?.label ?? "").trim();
  if (standLabel) return standLabel;
  const standId = String(stand?.id ?? holder?.location?.stand ?? "").trim();
  if (standId && !/[-:]/.test(standId)) return standId;
  if (standId) {
    const last = standId.split(/[-:]/).filter(Boolean).at(-1);
    if (last && last !== "room") return last;
  }
  const label = String(holder?.label ?? "").trim();
  if (label && /control-room|utility-station/i.test(label)) {
    const last = label.split(/[\s-]+/).filter(Boolean).at(-1);
    if (last) return last.toLowerCase();
  }
  if (label && !/^fixed:/i.test(label) && !looksLikeSlug(label)) return label;
  return standId || label;
}

function looksLikeSlug(text) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(text);
}

function stripLeadingArticle(text) {
  return String(text ?? "").replace(/^(the|a|an)\s+/i, "").trim();
}
