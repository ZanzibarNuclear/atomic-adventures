import { computed, reactive, ref, watch } from "vue";
import {
  availableMoves,
  offRoadNeighbors,
  buildRouteModels,
} from "./useRoutes.js";
import { axialToPixel, hexDistance } from "./useHexGeometry.js";
import { resolveAvatarPosition } from "./useAvatarStand.js";
import {
  BARRIER_OPENING_KINDS,
  fenceSegments,
  riverSegments,
  travelOpenings,
  edgeBlock,
  findBarrierStand,
} from "./useTravelBarriers.js";

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
    import.meta.hot.accept("../../content/world/map.yaml", (mod) => {
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

  const fences = computed(() => fenceSegments(featureModels.value));
  const rivers = computed(() => riverSegments(featureModels.value));
  const travelBarrierCtx = computed(() => ({
    fences: fences.value,
    rivers: rivers.value,
    openings: travelOpenings(editableFeatures.value),
  }));

  const state = reactive({
    currentId: START,
    discovered: [START],
    /** Fixed { x, y } when a blocked move walked the avatar up to a barrier. */
    barrierStand: null,
    /** Barrier kind ('fence' | 'river') of the last blocked move attempt. */
    lastBlocked: null,
  });

  function markDiscovered(hexId) {
    if (!hexId || state.discovered.includes(hexId)) return;
    state.discovered = [...state.discovered, hexId];
  }

  // Any code path that moves the avatar (routes, off-road, builder, indoor exits)
  // must reveal the hex the player is standing on.
  watch(
    () => state.currentId,
    (hexId) => markDiscovered(hexId),
    { immediate: true },
  );

  const mode = ref("explored");
  const traveling = ref(false);

  const currentHexData = computed(() => hexById.value[state.currentId]);

  const avatarFromPos = computed(() => {
    const hex = currentHexData.value;
    if (!hex) return { x: 0, y: 0 };
    if (state.barrierStand) {
      return state.barrierStand;
    }
    return resolveAvatarPosition(hex, size);
  });

  const standOverride = computed(() =>
    state.barrierStand
      ? { hexId: state.currentId, standAt: state.barrierStand }
      : null,
  );

  const discoveredList = computed(() => state.discovered);

  const travelOpts = computed(() => ({
    fromHex: currentHexData.value,
    hexById: hexById.value,
    size,
    barriers: travelBarrierCtx.value,
  }));

  const moves = computed(() =>
    availableMoves(state.currentId, routeModels.value, travelOpts.value),
  );

  const offRoad = computed(() =>
    offRoadNeighbors(
      state.currentId,
      editableHexes.value,
      hexById.value,
      moves.value.map((m) => m.toHexId),
      size,
      travelBarrierCtx.value,
    ),
  );

  const atBuildingEntrance = computed(
    () => currentHexData.value?.area === "utility",
  );
  const atGatePuzzle = computed(() => currentHexData.value?.puzzle === "gate");

  function moveTo(hexId) {
    if (traveling.value || !hexById.value[hexId]) return;
    const fromHex = hexById.value[state.currentId];
    const toHex = hexById.value[hexId];
    if (!fromHex || !toHex) return;
    if (hexId === state.currentId) return;
    if (hexDistance(fromHex, toHex) !== 1) return;

    // Route legs are pre-filtered by isRouteMoveBlocked; everything else
    // goes through the deterministic edge check.
    const routeLeg = moves.value.find((m) => m.toHexId === hexId);
    const blocked = routeLeg
      ? null
      : edgeBlock(fromHex, toHex, size, travelBarrierCtx.value);

    traveling.value = true;
    setTimeout(() => {
      traveling.value = false;
    }, 650);

    if (blocked) {
      // Never commit a blocked move: the avatar stays on its current hex,
      // walking up to the barrier when the straight line actually hits it.
      const toCenter = axialToPixel(toHex.q, toHex.r, size);
      const stand = findBarrierStand(
        avatarFromPos.value,
        toCenter,
        travelBarrierCtx.value,
        fromHex,
        toHex,
        size,
      );
      if (stand) {
        state.barrierStand = {
          x: Math.round(stand.x),
          y: Math.round(stand.y),
        };
      }
      state.lastBlocked = blocked;
      return;
    }

    state.currentId = hexId;
    state.barrierStand = null;
    state.lastBlocked = null;
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
    state.barrierStand = null;
    state.lastBlocked = null;
  }

  function nameOf(hexId) {
    const h = hexById.value[hexId];
    return h?.landmark?.name ?? hexId;
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
    fences,
    rivers,
    state,
    mode,
    traveling,
    standOverride,
    currentHexData,
    discoveredList,
    markDiscovered,
    moves,
    offRoad,
    atBuildingEntrance,
    atGatePuzzle,
    moveTo,
    autoTravel,
    resetPlayer,
    nameOf,
  });
}
