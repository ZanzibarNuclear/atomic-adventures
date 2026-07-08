import { BARRIER_OPENING_KINDS } from "../travel/barrierContext.js";
import {
  barrierKindForOpening,
  hiddenOpeningsInHex,
} from "./useBarrierOpenings.js";

export function useOutdoorBarrierSearch({
  state,
  editableFeatures,
  travelBarrierCtx,
  size,
  hexAtPoint,
}) {
  function markOpeningDiscovered(openingId) {
    if (!openingId || state.discoveredOpenings.includes(openingId)) return;
    state.discoveredOpenings = [...state.discoveredOpenings, openingId];
  }

  function searchableOpenings() {
    const hexId = state.currentId;
    const hidden = hiddenOpeningsInHex(
      editableFeatures.value,
      hexId,
      state.discoveredOpenings,
    );
    if (!hidden.length) return [];
    const barrier = currentBarrierKind();
    if (barrier) {
      return hidden.filter((f) => barrierKindForOpening(f.kind) === barrier);
    }
    return hidden;
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

  function discoveredFenceOpeningInCurrentHex() {
    const discovered = new Set(state.discoveredOpenings);
    return editableFeatures.value.some(
      (f) =>
        f.hex === state.currentId &&
        BARRIER_OPENING_KINDS.has(f.kind) &&
        barrierKindForOpening(f.kind) === "fence" &&
        discovered.has(f.id),
    );
  }

  function canSearchHere() {
    const barrier = currentBarrierKind();
    return (
      searchableOpenings().length > 0 ||
      barrier === "fence" ||
      barrier === "river" ||
      (barrierCutsCurrentHex("fence") && !discoveredFenceOpeningInCurrentHex())
    );
  }

  function searchBarrier() {
    const found = searchableOpenings();
    for (const f of found) {
      markOpeningDiscovered(f.id);
    }
    const kind = currentBarrierKind() ??
      found.map((f) => barrierKindForOpening(f.kind)).find(Boolean) ??
      (barrierCutsCurrentHex("fence") ? "fence" : null);
    state.lastSearch = {
      kind,
      found: found.map((f) => f.id),
      foundKinds: found.map((f) => f.kind),
    };
    return found.map((f) => f.id);
  }

  return {
    markOpeningDiscovered,
    canSearchHere,
    searchBarrier,
    searchableOpenings,
    barrierCutsCurrentHex,
  };
}
