import { computed, reactive, ref, watch } from "vue";
import { hexLabel } from "../../displayLabel.js";
import {
  availableMoves,
  directNeighbors,
  buildRouteModels,
  buildMovePath,
  routeLegBetween,
} from "./useRoutes.js";
import { hexDistance, pixelToHex } from "./useHexGeometry.js";
import {
  resolveAvatarPosition,
  resolveNeighborStand,
} from "./useAvatarStand.js";
import {
  BARRIER_OPENING_KINDS,
  barrierSegments,
  travelOpenings,
  resolveMove,
  isLandmarkReachable,
} from "./useTravelBarriers.js";
import {
  barrierKindForOpening,
  hiddenOpeningsInHex,
} from "./useBarrierOpenings.js";
import {
  availablePassageCrossings,
  resolvePassageStand,
  shouldOfferPassageCrossing,
} from "./usePassageCrossing.js";
import { barrierHintAtStand } from "./useBarrierStand.js";
import {
  applyPassageCrossEffects,
  applyPassageUnlock,
  filterAvailablePassages,
  passageRequirementSatisfied,
} from "./usePassageState.js";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function initialStand(mapData, size) {
  const START = mapData.start ?? mapData.journey[0];
  const hexes = mapData.hexes ?? [];
  const hex = hexes.find((h) => h.id === START);
  if (!hex) return { x: 0, y: 0 };
  return resolveAvatarPosition(hex, size);
}

export function useOutdoorWorld(mapData, gameState = null) {
  const size = ref(mapData.size ?? 44);
  const startId = ref(mapData.start ?? mapData.journey?.[0] ?? null);
  const sourceMapData = ref(clonePlain(mapData));

  const editableHexes = ref(clonePlain(mapData.hexes ?? []));
  const editableFeatures = ref(clonePlain(mapData.features ?? []));
  const editableRoutes = ref(clonePlain(mapData.routes ?? []));

  function syncFromMapData(data) {
    sourceMapData.value = clonePlain(data);
    size.value = data.size ?? size.value;
    startId.value = data.start ?? data.journey?.[0] ?? startId.value;
    editableHexes.value = clonePlain(data.hexes ?? []);
    editableFeatures.value = clonePlain(data.features ?? []);
    editableRoutes.value = clonePlain(data.routes ?? []);
  }

  const hexById = computed(() =>
    Object.fromEntries(editableHexes.value.map((h) => [h.id, h])),
  );

  const displayMapData = computed(() => ({
    ...sourceMapData.value,
    hexes: editableHexes.value,
    features: editableFeatures.value,
  }));

  const routeModels = computed(() =>
    buildRouteModels(
      editableRoutes.value,
      hexById.value,
      editableHexes.value,
      size.value,
    ),
  );

  const mapFeatures = computed(() =>
    editableFeatures.value.filter((f) => !BARRIER_OPENING_KINDS.has(f.kind)),
  );

  const featureModels = computed(() =>
    buildRouteModels(
      mapFeatures.value,
      hexById.value,
      editableHexes.value,
      size.value,
    ),
  );

  const rivers = computed(() =>
    barrierSegments(featureModels.value).filter((s) => s.kind === "river"),
  );
  const hexCoordMap = computed(
    () => new Map(editableHexes.value.map((h) => [`${h.q},${h.r}`, h.id])),
  );

  function hexAtPoint(pt, fallbackHexId) {
    const { q, r } = pixelToHex(pt.x, pt.y, size.value);
    return hexCoordMap.value.get(`${q},${r}`) ?? fallbackHexId;
  }

  const travelBarrierCtx = computed(() => {
    const allOpenings = travelOpenings(editableFeatures.value, {
      hexById: hexById.value,
      size: size.value,
      discoveredOpenings: state.discoveredOpenings,
    });
    return {
      barriers: barrierSegments(featureModels.value),
      allOpenings,
      openings: filterAvailablePassages(allOpenings, gameState?.flags),
    };
  });

  const state = reactive({
    currentId: startId.value,
    discovered: startId.value ? [startId.value] : [],
    discoveredOpenings: [],
    /** Avatar world position — always persisted. */
    stand: initialStand(mapData, size.value),
    /** Barrier kind when a crossing failed before entering the destination hex. */
    lastBlocked: null,
    /** Barrier kind when standing at a barrier line inside the current hex. */
    atBarrier: null,
  });

  function defaultStandForHex(hexId) {
    const hex = hexById.value[hexId];
    if (!hex) return { x: 0, y: 0 };
    return resolveAvatarPosition(hex, size.value);
  }

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
    const barrier = state.atBarrier ?? state.lastBlocked;
    if (barrier) {
      return hidden.filter((f) => barrierKindForOpening(f.kind) === barrier);
    }
    return hidden;
  }

  function canSearchHere() {
    return searchableOpenings().length > 0;
  }

  function searchBarrier() {
    const found = searchableOpenings();
    for (const f of found) {
      markOpeningDiscovered(f.id);
    }
    return found.map((f) => f.id);
  }

  function markDiscovered(hexId) {
    if (!hexId || state.discovered.includes(hexId)) return;
    state.discovered = [...state.discovered, hexId];
  }

  watch(
    () => state.currentId,
    (hexId) => markDiscovered(hexId),
    { immediate: true },
  );

  const mode = ref("gameplay");
  const traveling = ref(false);

  const currentHexData = computed(() => hexById.value[state.currentId]);

  const avatarFromPos = computed(() => state.stand);

  const flags = computed(() => gameState?.flags ?? null);

  const standOverride = computed(() => ({
    hexId: state.currentId,
    standAt: state.stand,
  }));

  const discoveredList = computed(() => state.discovered);

  const travelOpts = computed(() => ({
    fromHex: currentHexData.value,
    hexById: hexById.value,
    size: size.value,
    barriers: travelBarrierCtx.value,
    fromPos: avatarFromPos.value,
    resolveStand: (toHex, fromHex, fromPos) =>
      resolveNeighborStand(
        fromHex ?? currentHexData.value,
        toHex,
        fromPos ?? avatarFromPos.value,
        size.value,
        travelBarrierCtx.value,
      ),
    hexAtPoint,
    routeModels: routeModels.value,
  }));

  const moves = computed(() =>
    availableMoves(state.currentId, routeModels.value, travelOpts.value),
  );

  const directMoves = computed(() =>
    directNeighbors(
      state.currentId,
      editableHexes.value,
      hexById.value,
      moves.value.map((m) => m.toHexId),
      size.value,
      travelBarrierCtx.value,
      avatarFromPos.value,
      (toHex, fromHex, fromPos) =>
        resolveNeighborStand(
          fromHex ?? hexById.value[state.currentId],
          toHex,
          fromPos ?? avatarFromPos.value,
          size.value,
          travelBarrierCtx.value,
        ),
      hexAtPoint,
    ),
  );

  /** Hex ids the player may travel to from the current stand (route + direct). */
  const reachableHexIds = computed(() => {
    const ids = new Set([state.currentId]);
    for (const m of moves.value) ids.add(m.toHexId);
    for (const m of directMoves.value) ids.add(m.toHexId);
    return ids;
  });

  /** In-hex passage crossings (bridge, ford, gate, hole) — same hex, other side of barrier. */
  const passageCrossings = computed(() =>
    availablePassageCrossings({
      hexId: state.currentId,
      fromPos: avatarFromPos.value,
      mapFeatures: editableFeatures.value,
      ctx: travelBarrierCtx.value,
      hexById: hexById.value,
      size: size.value,
      discoveredOpenings: state.discoveredOpenings,
      atBarrier:
        barrierHintAtStand(avatarFromPos.value, travelBarrierCtx.value.barriers) ??
        state.atBarrier ??
        state.lastBlocked,
    }),
  );

  const lockedPassageActions = computed(() => {
    const ctx = travelBarrierCtx.value;
    const atBarrier =
      barrierHintAtStand(avatarFromPos.value, ctx.barriers) ??
      state.atBarrier ??
      state.lastBlocked;
    return ctx.allOpenings
      .filter((opening) => opening.hex === state.currentId)
      .filter((opening) => opening.unlock)
      .filter((opening) => !passageRequirementSatisfied(opening, gameState?.flags))
      .filter((opening) =>
        shouldOfferPassageCrossing(
          opening,
          avatarFromPos.value,
          ctx,
          atBarrier,
        ),
      )
      .map((opening) => ({
        openingId: opening.id,
        label: opening.unlock.label ?? "Unlock the passage",
        status: opening.unlock.status ?? null,
      }));
  });

  function crossPassage(openingId) {
    const fromHex = currentHexData.value;
    if (!fromHex || !openingId) return;
    const fromPos = avatarFromPos.value;
    const ctx = travelBarrierCtx.value;
    const opening = ctx.openings.find((o) => o.id === openingId);
    if (!opening) return;
    const feature = editableFeatures.value.find((f) => f.id === openingId);
    if (feature?.hex !== fromHex.id) return;
    if (
      !shouldOfferPassageCrossing(
        opening,
        fromPos,
        ctx,
        barrierHintAtStand(fromPos, ctx.barriers) ??
          state.atBarrier ??
          state.lastBlocked,
      )
    ) {
      return;
    }

    const stand = resolvePassageStand(
      opening,
      fromPos,
      ctx,
      size.value,
      fromHex,
    );
    if (!stand) return;
    if (hexAtPoint(stand, fromHex.id) !== fromHex.id) return;

    applyMove({
      hexId: fromHex.id,
      stand,
      blocked: null,
      atBarrier: barrierHintAtStand(stand, ctx.barriers),
    });

    applyPassageCrossEffects(opening, gameState?.flags);
  }

  function unlockPassage(openingId) {
    if (
      !lockedPassageActions.value.some(
        (action) => action.openingId === openingId,
      )
    ) {
      return false;
    }
    const opening = travelBarrierCtx.value.allOpenings.find(
      (candidate) => candidate.id === openingId,
    );
    return applyPassageUnlock(opening, gameState?.flags);
  }

  /** Atomically commit hex + avatar position + barrier hints. */
  function applyMove({ hexId, stand, blocked, atBarrier }) {
    const rounded = {
      x: Math.round(stand.x),
      y: Math.round(stand.y),
    };
    state.currentId = hexAtPoint(rounded, hexId);
    state.stand = rounded;
    state.lastBlocked = blocked ?? null;
    state.atBarrier = atBarrier ?? null;
  }

  const atBuildingEntrance = computed(
    () =>
      !!currentHexData.value?.landmark?.building &&
      isLandmarkReachable(
        currentHexData.value,
        avatarFromPos.value,
        travelBarrierCtx.value,
        size.value,
      ),
  );
  function isAdjacentHex(hexId) {
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return false;
    return hexDistance(fromHex, toHex) === 1;
  }

  function resolveRouteLeg(toHexId) {
    const opts = travelOpts.value;
    const fromId = state.currentId;
    return (
      moves.value.find((m) => m.toHexId === toHexId) ??
      availableMoves(fromId, routeModels.value, opts).find(
        (m) => m.toHexId === toHexId,
      ) ??
      routeLegBetween(fromId, toHexId, routeModels.value)
    );
  }

  // "Reach" in the outdoor UI means "enter the destination cell"; the final
  // stand may still be an accessible-side barrier stop inside that cell.
  function previewMove(hexId) {
    if (hexId === state.currentId || !isAdjacentHex(hexId)) return null;
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return null;

    const fromPos = avatarFromPos.value;
    const ctx = travelBarrierCtx.value;
    const toPos = resolveNeighborStand(fromHex, toHex, fromPos, size.value, ctx);
    const routeLeg = resolveRouteLeg(hexId);
    const path = buildMovePath(
      fromPos,
      fromHex,
      toHex,
      toPos,
      routeLeg,
      routeModels.value,
    );
    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path,
      ctx,
      hexAtPoint,
      size: size.value,
    });
    return { fromHex, toHex, fromPos, toPos, routeLeg, path, result };
  }

  function canReachHex(hexId) {
    if (hexId === state.currentId) return true;
    const preview = previewMove(hexId);
    return preview?.result.activeHexId === preview?.toHex.id;
  }

  function moveTo(hexId) {
    if (traveling.value || !hexById.value[hexId]) return;
    const preview = previewMove(hexId);
    if (!preview || preview.result.activeHexId !== preview.toHex.id) return;
    const { fromHex, toHex, result } = preview;
    const ctx = travelBarrierCtx.value;

    traveling.value = true;
    setTimeout(() => {
      traveling.value = false;
    }, 650);

    const enteredDest = result.activeHexId === toHex.id;
    const failedCrossing = result.blockedKind && !enteredDest;
    const blockedInPlace =
      result.blockedKind &&
      result.activeHexId === fromHex.id &&
      !enteredDest;
    let atBarrier =
      result.blockedKind && enteredDest ? result.blockedKind : null;
    if (!atBarrier && enteredDest) {
      atBarrier = barrierHintAtStand(result.stand, ctx.barriers);
    }

    applyMove({
      hexId: result.activeHexId,
      stand: blockedInPlace ? fromPos : result.stand,
      blocked: failedCrossing || blockedInPlace ? result.blockedKind : null,
      atBarrier: blockedInPlace ? result.blockedKind : atBarrier,
    });
  }

  function resetPlayer() {
    state.currentId = startId.value;
    state.discovered = startId.value ? [startId.value] : [];
    state.discoveredOpenings = [];
    state.stand = defaultStandForHex(startId.value);
    state.lastBlocked = null;
    state.atBarrier = null;
  }

  function nameOf(hexId) {
    const h = hexById.value[hexId];
    return hexLabel(h);
  }

  function hintAtStand() {
    return barrierHintAtStand(
      state.stand,
      travelBarrierCtx.value.barriers,
    );
  }

  return reactive({
    mapData: sourceMapData,
    size,
    START: startId,
    editableHexes,
    editableFeatures,
    editableRoutes,
    syncFromMapData,
    hexById,
    displayMapData,
    routeModels,
    mapFeatures,
    featureModels,
    rivers,
    travelBarrierCtx,
    barrierHintAtStand: hintAtStand,
    state,
    mode,
    traveling,
    standOverride,
    currentHexData,
    discoveredList,
    markDiscovered,
    markOpeningDiscovered,
    canSearchHere,
    searchBarrier,
    searchableOpenings,
    moves,
    directMoves,
    reachableHexIds,
    passageCrossings,
    lockedPassageActions,
    atBuildingEntrance,
    flags,
    unlockPassage,
    moveTo,
    crossPassage,
    previewMove,
    canReachHex,
    isAdjacentHex,
    resetPlayer,
    defaultStandForHex,
    nameOf,
  });
}
