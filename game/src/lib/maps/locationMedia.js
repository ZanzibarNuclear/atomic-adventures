import {
  normalizeStandEntries,
  resolveStandPoint,
} from "./composables/useAvatarStand.js";

const POINT_EPSILON = 1.5;

export function publicAssetPath(path) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path.replace(/^\.?\//, "")}`;
}

export function imageLocationViews(views = []) {
  return (Array.isArray(views) ? views : [])
    .filter((view) => view?.kind === "image" && view.src)
    .map((view) => ({
      ...view,
      label: view.label || view.id || "Location view",
      alt: view.alt || view.label || view.id || "Location view",
    }));
}

export function resolveIndoorLocationMedia(indoor) {
  const roomId = indoor?.indoor?.currentRoom;
  if (!roomId) return null;
  const room = indoor.building?.roomById?.[roomId];
  if (!room) return null;
  const standId = indoor.indoor.currentStand ?? null;
  const stand = standId
    ? (room.stands ?? []).find((candidate) => candidate.id === standId)
    : null;
  const standViews = imageLocationViews(stand?.views);
  if (standViews.length) {
    return {
      key: `indoors:${roomId}:stand:${standId}`,
      scope: "stand",
      locationId: standId,
      views: standViews,
    };
  }
  const roomViews = imageLocationViews(room.views);
  if (!roomViews.length) return null;
  return {
    key: `indoors:${roomId}`,
    scope: "room",
    locationId: roomId,
    views: roomViews,
  };
}

export function resolveOutdoorLocationMedia(outdoor) {
  const hex = outdoor?.currentHexData;
  if (!hex) return null;
  const stand = currentOutdoorStand(hex, outdoor.state?.stand, Number(outdoor.size ?? 0));
  const standViews = imageLocationViews(stand?.views);
  if (standViews.length) {
    return {
      key: `outdoors:${hex.id}:stand:${stand.id}`,
      scope: "stand",
      locationId: stand.id,
      views: standViews,
    };
  }
  const hexViews = imageLocationViews(hex.views);
  if (!hexViews.length) return null;
  return {
    key: `outdoors:${hex.id}`,
    scope: "hex",
    locationId: hex.id,
    views: hexViews,
  };
}

export function currentOutdoorStand(hex, point, size) {
  if (!hex || !point || !Number.isFinite(size)) return null;
  return normalizeStandEntries(hex).find((stand) => {
    const resolved = resolveStandPoint(hex, stand.at, size);
    if (!resolved) return false;
    return Math.hypot(
      Math.round(resolved.x) - Math.round(point.x),
      Math.round(resolved.y) - Math.round(point.y),
    ) <= POINT_EPSILON;
  }) ?? null;
}
