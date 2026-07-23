import { computed, ref } from "vue";
import { buildRouteModels } from "./useRoutes.js";
import { pixelToHex } from "./useHexGeometry.js";
import {
  BARRIER_OPENING_KINDS,
  barrierSegments,
} from "./useTravelBarriers.js";

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function useOutdoorWorldModel(mapData) {
  const size = ref(mapData.size ?? 44);
  const startId = ref(mapData.start ?? mapData.journey?.[0] ?? null);
  const sourceMapData = ref(clonePlain(mapData));
  const editableHexes = ref(clonePlain(mapData.hexes ?? []));
  const editableFeatures = ref(clonePlain(mapData.features ?? []));
  const editableRoutes = ref(clonePlain(mapData.routes ?? []));

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
    barrierSegments(featureModels.value).filter(
      (s) => s.kind === "stream" || s.kind === "river",
    ),
  );

  const hexCoordMap = computed(
    () => new Map(editableHexes.value.map((h) => [`${h.q},${h.r}`, h.id])),
  );

  function hexAtPoint(pt, fallbackHexId) {
    const { q, r } = pixelToHex(pt.x, pt.y, size.value);
    return hexCoordMap.value.get(`${q},${r}`) ?? fallbackHexId;
  }

  function syncFromMapData(data) {
    sourceMapData.value = clonePlain(data);
    size.value = data.size ?? size.value;
    startId.value = data.start ?? data.journey?.[0] ?? startId.value;
    editableHexes.value = clonePlain(data.hexes ?? []);
    editableFeatures.value = clonePlain(data.features ?? []);
    editableRoutes.value = clonePlain(data.routes ?? []);
  }

  return {
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
  };
}
