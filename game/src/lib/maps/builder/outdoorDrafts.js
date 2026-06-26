import { axialToPixel } from "../composables/useHexGeometry.js";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function landmarkDraftFrom(landmark = {}) {
  return {
    icon: landmark.icon ?? "",
    label: landmark.label ?? "",
    building: landmark.building ?? "",
    blurb: landmark.blurb ?? "",
    dx: Number(landmark.dx ?? 0),
    dy: Number(landmark.dy ?? 0),
  };
}

export function landmarkFromDraft(draft = {}) {
  return {
    ...(String(draft.building ?? "").trim() ? { building: String(draft.building).trim() } : {}),
    ...(String(draft.icon ?? "").trim() ? { icon: String(draft.icon).trim() } : {}),
    ...(String(draft.label ?? "").trim() ? { label: String(draft.label).trim() } : {}),
    ...(Number(draft.dx) ? { dx: Number(draft.dx) } : {}),
    ...(Number(draft.dy) ? { dy: Number(draft.dy) } : {}),
    ...(String(draft.blurb ?? "").trim() ? { blurb: String(draft.blurb).trim() } : {}),
  };
}

export function standDraftFrom(stand = {}) {
  const at = stand.at ?? {};
  return {
    id: stand.id ?? "",
    label: stand.label ?? "",
    anchor: at.from === "landmark" ? "landmark" : at.x != null ? "world" : "hex",
    dx: Number(at.dx ?? 0),
    dy: Number(at.dy ?? 0),
    x: Number(at.x ?? 0),
    y: Number(at.y ?? 0),
  };
}

export function standFromDraft(draft = {}) {
  const at = draft.anchor === "world"
    ? { x: Number(draft.x), y: Number(draft.y) }
    : draft.anchor === "landmark"
      ? { from: "landmark", dx: Number(draft.dx), dy: Number(draft.dy) }
      : { dx: Number(draft.dx), dy: Number(draft.dy) };
  return {
    id: String(draft.id ?? "").trim(),
    ...(String(draft.label ?? "").trim() ? { label: String(draft.label).trim() } : {}),
    at,
  };
}

export function normalizeStand(stand = {}) {
  return {
    id: String(stand.id ?? "").trim(),
    ...(String(stand.label ?? "").trim() ? { label: String(stand.label).trim() } : {}),
    at: clonePlain(stand.at ?? {}),
  };
}

export function applyStandPointToDraft(draft, hex, x, y, size) {
  if (!draft || !hex || size == null) return;
  if (draft.anchor === "world") {
    draft.x = Math.round(x);
    draft.y = Math.round(y);
    return;
  }
  const center = axialToPixel(hex.q, hex.r, size);
  const anchor = draft.anchor === "landmark" && hex.landmark
    ? {
      x: center.x + size * (hex.landmark.dx ?? 0),
      y: center.y + size * (hex.landmark.dy ?? 0),
    }
    : center;
  draft.dx = Math.round(((x - anchor.x) / size) * 100) / 100;
  draft.dy = Math.round(((y - anchor.y) / size) * 100) / 100;
}
