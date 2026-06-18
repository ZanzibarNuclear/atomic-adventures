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
