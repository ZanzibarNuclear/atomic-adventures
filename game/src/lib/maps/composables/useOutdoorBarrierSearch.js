import {
  BARRIER_OPENING_KINDS,
  isWaterBarrier,
} from "../travel/barrierContext.js";
import {
  hiddenOpeningsInHex,
  openingMatchesBarrierKind,
} from "./useBarrierOpenings.js";

const SEARCHABLE_BARRIER_KINDS = ["fence", "stream", "river"];

export function useOutdoorBarrierSearch({
  state,
  editableFeatures,
  travelBarrierCtx,
  size,
  hexAtPoint,
  hexById = null,
}) {
  function markOpeningDiscovered(openingId) {
    if (!openingId || state.discoveredOpenings.includes(openingId)) return;
    state.discoveredOpenings = [...state.discoveredOpenings, openingId];
  }

  function currentHex() {
    if (!hexById) return null;
    const map = hexById.value ?? hexById;
    return map?.[state.currentId] ?? null;
  }

  function barrierSearchSuppressed() {
    return Boolean(currentHex()?.suppressBarrierSearch);
  }

  function currentBarrierKind() {
    return state.atBarrier ?? state.lastBlocked ?? null;
  }

  function barrierCutsCurrentHex(kind) {
    const hexId = state.currentId;
    if (!hexId) return false;
    const sampleStep = size.value / 6;
    for (const seg of travelBarrierCtx.value.barriers ?? []) {
      if (seg.kind !== kind) continue;
      const length = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      const steps = Math.max(1, Math.ceil(length / sampleStep));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = {
          x: seg.a.x + (seg.b.x - seg.a.x) * t,
          y: seg.a.y + (seg.b.y - seg.a.y) * t,
        };
        if (hexAtPoint(point, null) === hexId) return true;
      }
    }
    return false;
  }

  function discoveredOpeningOfKindInCurrentHex(barrierKind) {
    const discovered = new Set(state.discoveredOpenings);
    return editableFeatures.value.some(
      (f) =>
        f.hex === state.currentId &&
        BARRIER_OPENING_KINDS.has(f.kind) &&
        openingMatchesBarrierKind(f.kind, barrierKind) &&
        discovered.has(f.id),
    );
  }

  function searchableOpenings(kind = null) {
    const hexId = state.currentId;
    const hidden = hiddenOpeningsInHex(
      editableFeatures.value,
      hexId,
      state.discoveredOpenings,
    );
    const targetKind = kind ?? currentBarrierKind();
    if (targetKind) {
      return hidden.filter((f) => openingMatchesBarrierKind(f.kind, targetKind));
    }
    return hidden;
  }

  function canSearchBarrierKind(kind) {
    if (barrierSearchSuppressed()) return false;
    if (!SEARCHABLE_BARRIER_KINDS.includes(kind)) return false;
    if (currentBarrierKind() === kind) return true;
    if (barrierCutsCurrentHex(kind) && !discoveredOpeningOfKindInCurrentHex(kind)) {
      return true;
    }
    // Fence openings always enable a fence search in the hex.
    if (kind === "fence" && searchableOpenings("fence").length > 0) return true;
    // Water openings (ford/bridge) only enable the water kind that is present.
    if (isWaterBarrier(kind) && searchableOpenings(kind).length > 0) {
      return barrierCutsCurrentHex(kind) || currentBarrierKind() === kind;
    }
    return false;
  }

  function availableSearchKinds() {
    if (barrierSearchSuppressed()) return [];
    return SEARCHABLE_BARRIER_KINDS.filter((kind) => canSearchBarrierKind(kind));
  }

  function canSearchHere() {
    return availableSearchKinds().length > 0;
  }

  function resolveSearchKind(kind = null) {
    if (kind && SEARCHABLE_BARRIER_KINDS.includes(kind)) return kind;
    const current = currentBarrierKind();
    if (current && canSearchBarrierKind(current)) return current;
    return availableSearchKinds()[0] ?? null;
  }

  function searchBarrier(kind = null) {
    const searchKind = resolveSearchKind(kind);
    const found = searchKind ? searchableOpenings(searchKind) : [];
    for (const f of found) {
      markOpeningDiscovered(f.id);
    }
    state.lastSearch = {
      kind: searchKind,
      found: found.map((f) => f.id),
      foundKinds: found.map((f) => f.kind),
    };
    return found.map((f) => f.id);
  }

  return {
    markOpeningDiscovered,
    canSearchHere,
    canSearchBarrierKind,
    availableSearchKinds,
    searchBarrier,
    searchableOpenings,
    barrierCutsCurrentHex,
  };
}
