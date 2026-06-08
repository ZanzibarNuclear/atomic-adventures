import { computed, reactive, ref } from "vue";
import {
  availableMoves,
  offRoadNeighbors,
  buildRouteModels,
  fenceSegments,
} from "./useRoutes.js";

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
    editableFeatures.value.filter((f) => f.kind !== "gate"),
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

  const state = reactive({
    currentId: START,
    discovered: new Set([START]),
  });

  const mode = ref("explored");
  const traveling = ref(false);
  const outdoorStand = ref(null);

  const currentHexData = computed(() => hexById.value[state.currentId]);
  const discoveredList = computed(() => [...state.discovered]);

  const moves = computed(() =>
    availableMoves(state.currentId, routeModels.value),
  );

  const offRoad = computed(() =>
    offRoadNeighbors(
      state.currentId,
      editableHexes.value,
      hexById.value,
      moves.value.map((m) => m.toHexId),
      size,
      fences.value,
    ),
  );

  const atBuildingEntrance = computed(
    () => currentHexData.value?.area === "utility",
  );
  const atGatePuzzle = computed(() => currentHexData.value?.puzzle === "gate");

  function moveTo(hexId) {
    if (traveling.value || !hexById.value[hexId]) return;
    traveling.value = true;
    state.currentId = hexId;
    state.discovered.add(hexId);
    outdoorStand.value = null;
    setTimeout(() => {
      traveling.value = false;
    }, 650);
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
    state.discovered = new Set([START]);
    outdoorStand.value = null;
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
    state,
    mode,
    traveling,
    outdoorStand,
    currentHexData,
    discoveredList,
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
