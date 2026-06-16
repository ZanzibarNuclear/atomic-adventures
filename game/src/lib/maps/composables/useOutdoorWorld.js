import { computed, reactive, ref, watch } from "vue";
import { hexLabel } from "../../displayLabel.js";
import {
  availableMoves,
  directNeighbors,
  buildRouteModels,
  buildMovePath,
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
  canOfferNeighbor,
} from "./useTravelBarriers.js";
import {
  barrierKindForOpening,
  hiddenOpeningsInHex,
} from "./useBarrierOpenings.js";
import {
  availablePassageCrossings,
  standAcrossOpening,
  isOnRiverBank,
} from "./usePassageCrossing.js";

function initialStand(mapData, size) {
  const START = mapData.start ?? mapData.journey[0];
  const hexes = mapData.hexes ?? [];
  const hex = hexes.find((h) => h.id === START);
  if (!hex) return { x: 0, y: 0 };
  return resolveAvatarPosition(hex, size);
}

export function useOutdoorWorld(mapData) {
  const size = mapData.size ?? 44;
  const START = mapData.start ?? mapData.journey[0];

  const editableHexes = ref(structuredClone(mapData.hexes ?? []));
  const editableFeatures = ref(structuredClone(mapData.features ?? []));
  const editableRoutes = ref(structuredClone(mapData.routes ?? []));

  function syncFromMapData(data) {
    editableHexes.value = structuredClone(data.hexes ?? []);
    editableFeatures.value = structuredClone(data.features ?? []);
    editableRoutes.value = structuredClone(data.routes ?? []);
  }

  if (import.meta.hot) {
    import.meta.hot.accept("../../../../content/world/map.yaml", (mod) => {
      if (mod?.default) syncFromMapData(mod.default);
    });
  }

  const hexById = computed(() =>
    Object.fromEntries(editableHexes.value.map((h) => [h.id, h])),
  );

  const displayMapData = computed(() => ({
    ...mapData,
    hexes: editableHexes.value,
    features: editableFeatures.value,
  }));

  const routeModels = computed(() =>
    buildRouteModels(
      editableRoutes.value,
      hexById.value,
      editableHexes.value,
      size,
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
      size,
    ),
  );

  const rivers = computed(() =>
    barrierSegments(featureModels.value).filter((s) => s.kind === "river"),
  );
  const hexCoordMap = computed(
    () => new Map(editableHexes.value.map((h) => [`${h.q},${h.r}`, h.id])),
  );

  function hexAtPoint(pt, fallbackHexId) {
    const { q, r } = pixelToHex(pt.x, pt.y, size);
    return hexCoordMap.value.get(`${q},${r}`) ?? fallbackHexId;
  }

  const travelBarrierCtx = computed(() => ({
    barriers: barrierSegments(featureModels.value),
    openings: travelOpenings(editableFeatures.value, {
      hexById: hexById.value,
      size,
      discoveredOpenings: state.discoveredOpenings,
    }),
  }));

  const state = reactive({
    currentId: START,
    discovered: [START],
    discoveredOpenings: [],
    /** Avatar world position — always persisted. */
    stand: initialStand(mapData, size),
    /** Barrier kind when a crossing failed before entering the destination hex. */
    lastBlocked: null,
    /** Barrier kind when standing at a barrier line inside the current hex. */
    atBarrier: null,
  });

  function defaultStandForHex(hexId) {
    const hex = hexById.value[hexId];
    if (!hex) return { x: 0, y: 0 };
    return resolveAvatarPosition(hex, size);
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

  const mode = ref("explored");
  const traveling = ref(false);

  const currentHexData = computed(() => hexById.value[state.currentId]);

  const avatarFromPos = computed(() => state.stand);

  const standOverride = computed(() => ({
    hexId: state.currentId,
    standAt: state.stand,
  }));

  const discoveredList = computed(() => state.discovered);

  const travelOpts = computed(() => ({
    fromHex: currentHexData.value,
    hexById: hexById.value,
    size,
    barriers: travelBarrierCtx.value,
    fromPos: avatarFromPos.value,
    resolveStand: (toHex, fromHex, fromPos) =>
      resolveNeighborStand(
        fromHex ?? currentHexData.value,
        toHex,
        fromPos ?? avatarFromPos.value,
        size,
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
      size,
      travelBarrierCtx.value,
      avatarFromPos.value,
      (toHex, fromHex, fromPos) =>
        resolveNeighborStand(
          fromHex ?? hexById.value[state.currentId],
          toHex,
          fromPos ?? avatarFromPos.value,
          size,
          travelBarrierCtx.value,
        ),
      hexAtPoint,
    ),
  );

  /** In-hex passage crossings (bridge, ford, gate, hole) — same hex, other side of barrier. */
  const passageCrossings = computed(() =>
    availablePassageCrossings({
      hexId: state.currentId,
      fromPos: avatarFromPos.value,
      mapFeatures: editableFeatures.value,
      ctx: travelBarrierCtx.value,
      hexById: hexById.value,
      size,
      discoveredOpenings: state.discoveredOpenings,
      atBarrier: state.atBarrier ?? state.lastBlocked,
    }),
  );

  function crossPassage(openingId) {
    const fromHex = currentHexData.value;
    if (!fromHex || !openingId) return;
    const fromPos = avatarFromPos.value;
    const ctx = travelBarrierCtx.value;
    const opening = ctx.openings.find((o) => o.id === openingId);
    if (!opening) return;
    const feature = editableFeatures.value.find((f) => f.id === openingId);
    if (feature?.hex !== fromHex.id) return;

    const stand = standAcrossOpening(opening, fromPos, ctx, size);
    if (!stand) return;
    if (hexAtPoint(stand, fromHex.id) !== fromHex.id) return;

    applyMove({
      hexId: fromHex.id,
      stand,
      blocked: null,
      atBarrier: null,
    });
  }

  /** Atomically commit hex + avatar position + barrier hints. */
  function applyMove({ hexId, stand, blocked, atBarrier }) {
    state.currentId = hexId;
    state.stand = {
      x: Math.round(stand.x),
      y: Math.round(stand.y),
    };
    state.lastBlocked = blocked ?? null;
    state.atBarrier = atBarrier ?? null;
  }

  const atBuildingEntrance = computed(
    () => currentHexData.value?.area === "utility",
  );
  const atGatePuzzle = computed(() => currentHexData.value?.puzzle === "gate");

  function isAdjacentHex(hexId) {
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return false;
    return hexDistance(fromHex, toHex) === 1;
  }

  function canReachHex(hexId) {
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return false;
    if (hexId === state.currentId) return true;
    if (!isAdjacentHex(hexId)) return false;

    const fromPos = avatarFromPos.value;
    const ctx = travelBarrierCtx.value;
    const toPos = resolveNeighborStand(fromHex, toHex, fromPos, size, ctx);
    const routeLeg = availableMoves(state.currentId, routeModels.value, null).find(
      (m) => m.toHexId === hexId,
    );
    const path = buildMovePath(
      fromPos,
      fromHex,
      toHex,
      toPos,
      routeLeg,
      routeModels.value,
      { barriers: ctx, size },
    );
    return canOfferNeighbor({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path,
      ctx,
      hexAtPoint,
    });
  }

  function moveTo(hexId) {
    if (traveling.value || !hexById.value[hexId]) return;
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return;
    if (hexId === state.currentId) return;
    if (hexDistance(fromHex, toHex) !== 1) return;

    const fromPos = avatarFromPos.value;
    const ctx = travelBarrierCtx.value;
    const toPos = resolveNeighborStand(fromHex, toHex, fromPos, size, ctx);
    const routeLeg = moves.value.find((m) => m.toHexId === hexId);
    const path = buildMovePath(
      fromPos,
      fromHex,
      toHex,
      toPos,
      routeLeg,
      routeModels.value,
      { barriers: ctx, size },
    );

    const result = resolveMove({
      fromHex,
      toHex,
      fromPos,
      toPos,
      path,
      ctx,
      hexAtPoint,
    });

    traveling.value = true;
    setTimeout(() => {
      traveling.value = false;
    }, 650);

    const enteredDest = result.activeHexId === toHex.id;
    const failedCrossing = result.blockedKind && !enteredDest;
    let atBarrier =
      result.blockedKind && enteredDest ? result.blockedKind : null;
    if (!atBarrier && enteredDest && isOnRiverBank(result.stand, ctx.barriers)) {
      atBarrier = "river";
    }

    applyMove({
      hexId: result.activeHexId,
      stand: result.stand,
      blocked: failedCrossing ? result.blockedKind : null,
      atBarrier,
    });
  }

  async function autoTravel() {
    const main =
      routeModels.value.find((r) => r.id === "hero-route") ??
      routeModels.value[0];
    if (!main) return;
    const sequence = main.spans.map((s) => s.hexId).filter((id) => id != null);
    let idx = sequence.indexOf(state.currentId);
    if (idx === -1) idx = 0;
    for (let i = idx + 1; i < sequence.length; i++) {
      moveTo(sequence[i]);
      await new Promise((r) => setTimeout(r, 750));
    }
  }

  function resetPlayer() {
    state.currentId = START;
    state.discovered = [START];
    state.discoveredOpenings = [];
    state.stand = defaultStandForHex(START);
    state.lastBlocked = null;
    state.atBarrier = null;
  }

  function nameOf(hexId) {
    const h = hexById.value[hexId];
    return hexLabel(h);
  }

  return reactive({
    mapData,
    size,
    START,
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
    passageCrossings,
    atBuildingEntrance,
    atGatePuzzle,
    moveTo,
    crossPassage,
    canReachHex,
    isAdjacentHex,
    autoTravel,
    resetPlayer,
    defaultStandForHex,
    nameOf,
  });
}
