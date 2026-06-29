import { computed, reactive, ref, watch } from "vue";
import { hexLabel } from "../../displayLabel.js";
import {
  availableMoves,
  directNeighbors,
} from "./useRoutes.js";
import {
  resolveAvatarPosition,
  resolveNeighborStand,
} from "./useAvatarStand.js";
import {
  barrierSegments,
  travelOpenings,
  isLandmarkReachable,
} from "./useTravelBarriers.js";
import { barrierHintAtStand } from "./useBarrierStand.js";
import { useOutdoorWorldModel } from "./useOutdoorWorldModel.js";
import { useOutdoorBarrierSearch } from "./useOutdoorBarrierSearch.js";
import { useOutdoorPassages } from "./useOutdoorPassages.js";
import { useOutdoorMovement } from "./useOutdoorMovement.js";
import { advanceGameTime } from "../../character/gameTime.js";

function initialStand(mapData, size) {
  const START = mapData.start ?? mapData.journey[0];
  const hexes = mapData.hexes ?? [];
  const hex = hexes.find((h) => h.id === START);
  if (!hex) return { x: 0, y: 0 };
  return resolveAvatarPosition(hex, size);
}

export function useOutdoorWorld(mapData, gameState = null) {
  const {
    size,
    startId,
    sourceMapData,
    editableHexes,
    editableFeatures,
    editableRoutes,
    hexById,
    displayMapData,
    routeModels,
    mapFeatures,
    featureModels,
    rivers,
    hexAtPoint,
    syncFromMapData,
  } = useOutdoorWorldModel(mapData);

  const state = reactive({
    currentId: startId.value,
    discovered: startId.value ? [startId.value] : [],
    discoveredOpenings: [],
    /** Avatar world position — always persisted. */
    stand: initialStand(mapData, size.value),
    /** Previous outdoor hex entered by inter-hex movement. */
    previousId: null,
    /** Local-map transition used to return to the current outdoor hex. */
    localExit: null,
    /** Barrier kind when a crossing failed before entering the destination hex. */
    lastBlocked: null,
    /** Barrier kind when standing at a barrier line inside the current hex. */
    atBarrier: null,
    /** Last explicit barrier inspection result, for player-facing status text. */
    lastSearch: null,
    /** Explicit open/closed passage state, keyed by passage id. */
    passageStates: {},
  });

  const passages = useOutdoorPassages({
    state,
    gameState,
    editableFeatures,
    hexById,
    size,
    hexAtPoint,
    getTravelBarrierCtx: () => travelBarrierCtx.value,
    getCurrentHex: () => currentHexData.value,
    getAvatarFromPos: () => avatarFromPos.value,
    applyMove,
  });

  const travelBarrierCtx = computed(() => {
    const allOpenings = travelOpenings(editableFeatures.value, {
      hexById: hexById.value,
      size: size.value,
      discoveredOpenings: state.discoveredOpenings,
    });
    return {
      barriers: barrierSegments(featureModels.value),
      allOpenings,
      openings: allOpenings.filter((opening) => passages.isPassageAvailable(opening)),
    };
  });

  const {
    passageCrossings,
    lockedPassageActions,
    passageToggleActions,
    passageMarkerStates,
    unlockPassage,
    togglePassage,
    crossPassage,
  } = passages;

  function defaultStandForHex(hexId) {
    const hex = hexById.value[hexId];
    if (!hex) return { x: 0, y: 0 };
    return resolveAvatarPosition(hex, size.value);
  }

  const {
    markOpeningDiscovered,
    canSearchHere,
    searchBarrier: searchBarrierWithoutTime,
    searchableOpenings,
    barrierCutsCurrentHex,
  } = useOutdoorBarrierSearch({
    state,
    editableFeatures,
    travelBarrierCtx,
    size,
    hexAtPoint,
  });

  function searchBarrier() {
    const result = searchBarrierWithoutTime();
    if (gameState?.clock && gameState?.character) {
      advanceGameTime(gameState, 20, "moderate");
    }
    return result;
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

  const {
    traveling,
    isAdjacentHex,
    previewMove,
    canReachHex,
    moveTo,
  } = useOutdoorMovement({
    state,
    hexById,
    size,
    routeModels,
    moves,
    travelOpts,
    avatarFromPos,
    travelBarrierCtx,
    hexAtPoint,
    applyMove,
    advanceTime: () => {
      if (gameState?.clock && gameState?.character) {
        advanceGameTime(gameState, 15, "moderate");
      }
    },
  });

  /** Hex ids the player may travel to from the current stand (route + direct). */
  const reachableHexIds = computed(() => {
    const ids = new Set([state.currentId]);
    for (const m of moves.value) ids.add(m.toHexId);
    for (const m of directMoves.value) ids.add(m.toHexId);
    return ids;
  });

  /** Atomically commit hex + avatar position + barrier hints. */
  function applyMove({ hexId, stand, blocked, atBarrier, previousId = null }) {
    const rounded = {
      x: Math.round(stand.x),
      y: Math.round(stand.y),
    };
    const nextHexId = hexAtPoint(rounded, hexId);
    if (nextHexId !== state.currentId) state.previousId = previousId ?? state.currentId;
    state.localExit = null;
    state.currentId = nextHexId;
    state.stand = rounded;
    state.lastBlocked = blocked ?? null;
    state.atBarrier = atBarrier ?? null;
    state.lastSearch = null;
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
  function resetPlayer() {
    state.currentId = startId.value;
    state.discovered = startId.value ? [startId.value] : [];
    state.discoveredOpenings = [];
    state.stand = defaultStandForHex(startId.value);
    state.previousId = null;
    state.localExit = null;
    state.lastBlocked = null;
    state.atBarrier = null;
    state.lastSearch = null;
    state.passageStates = {};
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
    barrierCutsCurrentHex,
    moves,
    directMoves,
    reachableHexIds,
    passageCrossings,
    lockedPassageActions,
    passageToggleActions,
    passageMarkerStates,
    atBuildingEntrance,
    flags,
    unlockPassage,
    togglePassage,
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
