<script setup>
import { computed, reactive, ref, watch } from "vue";
import { Analytics } from "@vercel/analytics/vue";
import HexMap from "./components/HexMap.vue";
import GridMap from "./components/GridMap.vue";
import mapData from "../content/world/map.yaml";
import buildingData from "../content/world/utility-station.yaml";
import {
  availableMoves,
  offRoadNeighbors,
  buildRouteModels,
  fenceSegments,
} from "./composables/useRoutes.js";
import {
  applyRevealForDoor,
  applyRevealDoorsForRoom,
  buildBuilding,
  canUseExteriorExit,
  exteriorMovesFrom,
  exteriorStepOutMoves,
  isDestinationNamed,
  isDoorMapped,
  mapVisibilityCtx,
  movesFrom,
  moveKey,
} from "./composables/useGrid.js";
import {
  buildInitialDoorState,
  canPassDoor,
  canBargeThroughDoor,
  doorsFromRoom,
  doorLabel,
  doorStatusText,
  lockHintForDoor,
  getDoorState,
  setDoorOpen,
  canOpenDoor,
  canCloseDoor,
  canToggleLock,
  canToggleLockFromRoom,
  canBreakLock,
  toggleDoorLock,
  breakLock,
  setAllDoorsOpen,
  applyEnablerAutoUnlock,
  isManualEnablerActive,
  isEnablerLock,
  relockEnablerDoor,
  isSelfClosingDoor,
} from "./composables/useDoors.js";
import {
  createInventory,
  addItem,
  inventoryItems,
} from "./composables/useInventory.js";
import {
  listEditableLines,
  findEditableLine,
  resolvedWaypoints,
  setWaypointWorld,
  addWaypoint,
  removeWaypoint,
  exportMapYaml,
  listEditablePlacements,
  findEditablePlacement,
  resolvedPlacementHandles,
  setLandmarkWorld,
  setStandWorld,
  ensureDefaultStandAt,
} from "./composables/useMapBuilder.js";
import {
  listAllGridEditable,
  findGridEditable,
  gridEditModeForSource,
  resolvedPathHandles,
  resolvedPathNodeHandles,
  resolvedRoomHandles,
  resolvedDoorHandle,
  resolvedNodeHandle,
  setPathPoint,
  addPathPoint,
  removePathPoint,
  setRoomRect,
  setRoomName,
  setRoomFromHandle,
  setDoorAt,
  setRollDoorProps,
  setNodeAt,
  setNodeLabel,
  resolvedExitHandle,
  setExitMapAt,
  getExitMapAt,
  exportBuildingYaml,
} from "./composables/useGridBuilder.js";
import {
  landmarkAnchor,
  resolveAvatarPosition,
  hasLandmarkMarker,
} from "./composables/useAvatarStand.js";

const size = mapData.size ?? 44;
const START = mapData.start ?? mapData.journey[0];

// Editable copies — updated by the map builder.
const editableHexes = ref(structuredClone(mapData.hexes ?? []));
const editableFeatures = ref(structuredClone(mapData.features ?? []));
const editableRoutes = ref(structuredClone(mapData.routes ?? []));

function syncFromMapData(data) {
  editableHexes.value = structuredClone(data.hexes ?? []);
  editableFeatures.value = structuredClone(data.features ?? []);
  editableRoutes.value = structuredClone(data.routes ?? []);
}

if (import.meta.hot) {
  import.meta.hot.accept("../content/world/map.yaml", (mod) => {
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
  buildRouteModels(mapFeatures.value, hexById.value, editableHexes.value, size),
);
const fences = computed(() => fenceSegments(featureModels.value));

// --- Player state (the slice that would be saved/loaded) ---
const state = reactive({
  currentId: START,
  discovered: new Set([START]),
});

const mode = ref("explored"); // 'slice' | 'explored' | 'full'
const expanded = ref(false);
const builderView = ref(false);
const traveling = ref(false);

// --- Map builder ---
const editableItems = computed(() => [
  ...listEditablePlacements(editableHexes.value),
  ...listEditableLines(editableRoutes.value, editableFeatures.value),
]);
const editSelection = ref(""); // "hexes:utility-yard" | "routes:hero-route" | …
const selectedHandleId = ref(null);
const addPointMode = ref(false);
const exportStatus = ref("");

const editParsed = computed(() => {
  if (!editSelection.value) return null;
  const [source, id] = editSelection.value.split(":");
  if (source === "hexes") {
    const hex = findEditablePlacement(editableHexes.value, id);
    if (!hex) return null;
    return { source, id, hex };
  }
  const line = findEditableLine(
    editableRoutes.value,
    editableFeatures.value,
    source,
    id,
  );
  if (!line) return null;
  return { source, id, line };
});

const editMode = computed(() => {
  if (!editParsed.value) return null;
  return editParsed.value.source === "hexes" ? "placement" : "line";
});

const editHandles = computed(() => {
  const parsed = editParsed.value;
  if (!parsed) return [];
  if (parsed.source === "hexes") {
    return resolvedPlacementHandles(parsed.hex, size).map((h) => ({
      ...h,
      handleKey: h.role,
    }));
  }
  return resolvedWaypoints(parsed.line, hexById.value, size).map((h) => ({
    ...h,
    handleKey: `point-${h.index}`,
  }));
});

const builderEdit = computed(
  () => builderView.value && editParsed.value != null,
);

const standAnchoredToLandmark = computed(
  () => editParsed.value?.hex?.standAt?.from === "landmark",
);

watch(builderView, (on) => {
  if (on && !editSelection.value && editableItems.value.length) {
    const first = editableItems.value[0];
    editSelection.value = `${first.source}:${first.id}`;
  }
  if (!on) {
    addPointMode.value = false;
    selectedHandleId.value = null;
  }
});

watch(editSelection, (sel) => {
  selectedHandleId.value = null;
  addPointMode.value = false;
  if (!sel.startsWith("hexes:")) return;
  const id = sel.split(":")[1];
  const hex = findEditablePlacement(editableHexes.value, id);
  if (hex) {
    ensureDefaultStandAt(hex);
    state.currentId = id;
  }
});

function onSelectHandle(handleKey) {
  selectedHandleId.value = handleKey;
}

function onWaypointMove(payload) {
  const parsed = editParsed.value;
  if (!parsed) return;
  const { x, y, role, index } = payload;

  if (parsed.source === "hexes") {
    if (role === "landmark") setLandmarkWorld(parsed.hex, x, y, size);
    else if (role === "stand") setStandWorld(parsed.hex, x, y, size);
    return;
  }

  setWaypointWorld(parsed.line, index, x, y, hexById.value, size);
}

function onBuilderMapClick({ x, y }) {
  const parsed = editParsed.value;
  if (!parsed || parsed.source === "hexes") return;
  const idx = addWaypoint(parsed.line, x, y);
  selectedHandleId.value = `point-${idx}`;
}

function deleteSelectedPoint() {
  const parsed = editParsed.value;
  if (!parsed || parsed.source === "hexes") return;
  const match = selectedHandleId.value?.match(/^point-(\d+)$/);
  if (!match) return;
  const idx = Number(match[1]);
  if (!removeWaypoint(parsed.line, idx)) return;
  const next = Math.min(idx, parsed.line.points.length - 1);
  selectedHandleId.value = next >= 0 ? `point-${next}` : null;
}

function toggleSmooth() {
  const parsed = editParsed.value;
  if (!parsed?.line) return;
  parsed.line.smooth = !parsed.line.smooth;
}

function toggleStandAnchor() {
  const hex = editParsed.value?.hex;
  if (!hasLandmarkMarker(hex)) return;
  const pos = resolveAvatarPosition(hex, size);
  if (hex.standAt?.from === "landmark") {
    hex.standAt = { x: Math.round(pos.x), y: Math.round(pos.y) };
  } else {
    const anchor = landmarkAnchor(hex, size);
    hex.standAt = {
      from: "landmark",
      dx: Math.round(((pos.x - anchor.x) / size) * 100) / 100,
      dy: Math.round(((pos.y - anchor.y) / size) * 100) / 100,
    };
  }
}

async function copyYaml(which) {
  const yaml = exportMapYaml(
    editableRoutes.value,
    editableFeatures.value,
    editableHexes.value,
  );
  const text = yaml[which] || yaml.both;
  try {
    await navigator.clipboard.writeText(text);
    exportStatus.value = `Copied ${which} YAML`;
  } catch {
    exportStatus.value = "Copy failed — try Download";
  }
  setTimeout(() => {
    exportStatus.value = "";
  }, 2500);
}

function downloadYaml() {
  const yaml = exportMapYaml(
    editableRoutes.value,
    editableFeatures.value,
    editableHexes.value,
  );
  const blob = new Blob([yaml.both], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "map-export.yaml";
  a.click();
  URL.revokeObjectURL(url);
  exportStatus.value = "Downloaded map-export.yaml";
  setTimeout(() => {
    exportStatus.value = "";
  }, 2500);
}

function resetMapBuilder() {
  syncFromMapData(mapData);
  selectedHandleId.value = null;
  exportStatus.value = "Reset to file defaults";
  setTimeout(() => {
    exportStatus.value = "";
  }, 2500);
}

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

// Auto-walk forward along the hero's trail from wherever we are.
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

function reset() {
  state.currentId = START;
  state.discovered = new Set([START]);
  outdoorStand.value = null;
  place.value = "outdoors";
  resetIndoor();
}

function nameOf(hexId) {
  const h = hexById.value[hexId];
  return h?.landmark?.name ?? hexId;
}

// --- Indoor building state (the Utility Station) ---
const editableBuildingData = ref(structuredClone(buildingData));
const building = computed(() => buildBuilding(editableBuildingData.value));

function syncFromBuildingData(data) {
  editableBuildingData.value = structuredClone(data);
}

if (import.meta.hot) {
  import.meta.hot.accept("../content/world/utility-station.yaml", (mod) => {
    if (mod?.default) syncFromBuildingData(mod.default);
  });
}

const initialBuilding = buildBuilding(buildingData);
const place = ref("outdoors"); // 'outdoors' | 'indoors'
const outdoorStand = ref(null); // { hexId, standAt } — where you landed after stepping outside
const exitTravelHint = ref("");

const indoor = reactive({
  currentRoom: null,
  exteriorNode: initialBuilding.exterior?.entry ?? null,
  discovered: new Set(),
  revealed: new Set(),
  level: initialBuilding.exterior?.level ?? initialBuilding.levels[0]?.id,
  viewLevel: initialBuilding.exterior?.level ?? initialBuilding.levels[0]?.id,
  doorState: buildInitialDoorState(initialBuilding.areaId, initialBuilding),
  inventory: createInventory(),
  pickupsTaken: new Set(),
  facility: {
    hydroOnline: false, // set true when hydro generator is running (hub.hydro_online)
    manualMode: {},
  },
  moving: false,
});

// --- Grid map builder ---
const gridEditSelection = ref("");
const gridSelectedHandleId = ref(null);
const gridAddPointMode = ref(false);
const gridExportStatus = ref("");

const gridEditableItems = computed(() =>
  listAllGridEditable(editableBuildingData.value, indoor.viewLevel),
);

const gridEditParsed = computed(() => {
  if (!gridEditSelection.value) return null;
  const [source, id] = gridEditSelection.value.split(":");
  const entity = findGridEditable(editableBuildingData.value, source, id);
  if (!entity) return null;
  return { source, id, entity };
});

const gridEditMode = computed(() => {
  if (!gridEditParsed.value) return null;
  return gridEditModeForSource(gridEditParsed.value.source);
});

const gridCell = computed(() => editableBuildingData.value.cell ?? 64);

const gridEditHandles = computed(() => {
  const parsed = gridEditParsed.value;
  if (!parsed) return [];
  const cell = gridCell.value;
  if (parsed.source === "paths") {
    return [
      ...resolvedPathHandles(parsed.entity, cell, editableBuildingData.value),
      ...resolvedPathNodeHandles(
        editableBuildingData.value,
        parsed.entity,
        cell,
      ),
    ];
  }
  if (parsed.source === "rooms") {
    return resolvedRoomHandles(parsed.entity, cell);
  }
  if (parsed.source === "doors") {
    if (parsed.entity.kind === "roll") return [];
    return resolvedDoorHandle(parsed.entity, cell);
  }
  if (parsed.source === "nodes") {
    return resolvedNodeHandle(parsed.entity, cell);
  }
  if (parsed.source === "exits") {
    return resolvedExitHandle(parsed.entity, cell);
  }
  return [];
});

const gridBuilderEdit = computed(
  () =>
    builderView.value &&
    place.value === "indoors" &&
    gridEditParsed.value != null,
);

const gridRollDoorRoom = computed(() => {
  const door = gridEditParsed.value?.entity;
  if (!door || door.kind !== "roll" || !door.room) return null;
  return editableBuildingData.value.rooms?.find((r) => r.id === door.room) ?? null;
});

watch(builderView, (on) => {
  if (on && place.value === "indoors" && !gridEditSelection.value) {
    const items = gridEditableItems.value;
    if (items.length) {
      gridEditSelection.value = `${items[0].source}:${items[0].id}`;
    }
  }
  if (!on) {
    gridAddPointMode.value = false;
    gridSelectedHandleId.value = null;
  }
});

watch(
  () => place.value,
  (p) => {
    if (p !== "indoors") {
      gridEditSelection.value = "";
      gridSelectedHandleId.value = null;
      gridAddPointMode.value = false;
    } else if (builderView.value && !gridEditSelection.value) {
      const items = gridEditableItems.value;
      if (items.length) {
        gridEditSelection.value = `${items[0].source}:${items[0].id}`;
      }
    }
  },
);

watch(gridEditSelection, () => {
  gridSelectedHandleId.value = null;
  gridAddPointMode.value = false;
});

watch(
  () => indoor.viewLevel,
  () => {
    if (!gridEditSelection.value) return;
    const [source, id] = gridEditSelection.value.split(":");
    if (!findGridEditable(editableBuildingData.value, source, id)) {
      const items = gridEditableItems.value;
      gridEditSelection.value = items.length
        ? `${items[0].source}:${items[0].id}`
        : "";
    }
  },
);

function onGridSelectItem({ source, id }) {
  gridEditSelection.value = `${source}:${id}`;
}

function onGridHandleMove(payload) {
  const parsed = gridEditParsed.value;
  if (!parsed) return;
  const cell = gridCell.value;
  const xUnits = payload.x / cell;
  const yUnits = payload.y / cell;
  const { role, index } = payload;

  if (parsed.source === "paths") {
    if (role === "path-node" && payload.nodeId) {
      setNodeAt(
        editableBuildingData.value,
        payload.nodeId,
        xUnits,
        yUnits,
      );
      return;
    }
    setPathPoint(
      editableBuildingData.value,
      parsed.id,
      index,
      xUnits,
      yUnits,
    );
    return;
  }
  if (parsed.source === "rooms") {
    setRoomFromHandle(
      editableBuildingData.value,
      parsed.id,
      role,
      xUnits,
      yUnits,
    );
    return;
  }
  if (parsed.source === "doors") {
    setDoorAt(editableBuildingData.value, parsed.id, xUnits, yUnits);
    return;
  }
  if (parsed.source === "nodes") {
    setNodeAt(editableBuildingData.value, parsed.id, xUnits, yUnits);
    return;
  }
  if (parsed.source === "exits") {
    setExitMapAt(editableBuildingData.value, parsed.id, xUnits, yUnits);
  }
}

function onGridBuilderMapClick({ x, y }) {
  const parsed = gridEditParsed.value;
  if (!parsed || parsed.source !== "paths") return;
  const cell = gridCell.value;
  const idx = addPathPoint(
    editableBuildingData.value,
    parsed.id,
    x / cell,
    y / cell,
  );
  gridSelectedHandleId.value = idx >= 0 ? `point-${idx}` : null;
}

function deleteGridSelectedPoint() {
  const parsed = gridEditParsed.value;
  if (!parsed || parsed.source !== "paths") return;
  const match = gridSelectedHandleId.value?.match(/^point-(\d+)$/);
  if (!match) return;
  const idx = Number(match[1]);
  if (!removePathPoint(editableBuildingData.value, parsed.id, idx)) return;
  const path = parsed.entity;
  const next = Math.min(idx, path.points.length - 1);
  gridSelectedHandleId.value = next >= 0 ? `point-${next}` : null;
}

function toggleGridSmooth() {
  const path = gridEditParsed.value?.entity;
  if (!path || gridEditParsed.value.source !== "paths") return;
  path.smooth = !path.smooth;
}

async function copyGridYaml(which) {
  const yaml = exportBuildingYaml(editableBuildingData.value);
  const text = yaml[which] || yaml.all;
  try {
    await navigator.clipboard.writeText(text);
    gridExportStatus.value = `Copied ${which} YAML`;
  } catch {
    gridExportStatus.value = "Copy failed — try Download";
  }
  setTimeout(() => {
    gridExportStatus.value = "";
  }, 2500);
}

function downloadGridYaml() {
  const yaml = exportBuildingYaml(editableBuildingData.value);
  const blob = new Blob([yaml.all], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "utility-station-export.yaml";
  a.click();
  URL.revokeObjectURL(url);
  gridExportStatus.value = "Downloaded utility-station-export.yaml";
  setTimeout(() => {
    gridExportStatus.value = "";
  }, 2500);
}

function resetGridBuilder() {
  syncFromBuildingData(buildingData);
  gridSelectedHandleId.value = null;
  gridExportStatus.value = "Reset to file defaults";
  setTimeout(() => {
    gridExportStatus.value = "";
  }, 2500);
}

const indoorVisibility = computed(() =>
  mapVisibilityCtx(
    indoor.discovered,
    indoor.revealed,
    building.value,
    indoor.doorState,
    building.value.areaId,
    builderView.value,
    indoor.currentRoom,
    indoor.exteriorNode,
  ),
);

// You can enter the building when standing on a hex flagged as that area.
const atBuildingEntrance = computed(
  () => currentHexData.value?.area === "utility",
);
const atGatePuzzle = computed(() => currentHexData.value?.puzzle === "gate");
const currentRoomData = computed(() =>
  indoor.currentRoom ? building.value.roomById[indoor.currentRoom] : null,
);
const currentExteriorNode = computed(() =>
  indoor.exteriorNode
    ? building.value.exterior?.nodeById?.[indoor.exteriorNode]
    : null,
);
const indoorMoves = computed(() => {
  if (indoor.exteriorNode) {
    const moves = exteriorMovesFrom(building.value, indoor.exteriorNode).map(
      (m) => ({
        ...m,
        toExteriorNode: m.toNodeId,
      }),
    );
    const node = currentExteriorNode.value;
    if (
      node?.room &&
      canPassDoor(
        indoor.doorState,
        building.value.areaId,
        node.door,
        building.value.doorById[node.door],
      )
    ) {
      const room = building.value.roomById[node.room];
      moves.push({
        kind: "door",
        toRoomId: node.room,
        label: "through the door",
        toName: room?.name ?? node.room,
      });
    }
    return moves;
  }
  return [
    ...movesFrom(
      building.value,
      indoor.currentRoom,
      indoor.level,
      indoor.doorState,
      indoorVisibility.value,
    ),
    ...exteriorStepOutMoves(
      building.value,
      indoor.currentRoom,
      indoor.doorState,
      building.value.areaId,
    ),
  ];
});
/** One-step moves through closed but unlocked doors (room click opens the door, then enter). */
const bargeMoves = computed(() => {
  if (indoor.exteriorNode) {
    const node = currentExteriorNode.value;
    if (!node?.room || !node.door) return [];
    const door = building.value.doorById[node.door];
    if (
      canPassDoor(
        indoor.doorState,
        building.value.areaId,
        node.door,
        door,
      )
    ) {
      return [];
    }
    if (
      !canBargeThroughDoor(
        indoor.doorState,
        building.value.areaId,
        node.door,
        door,
      )
    ) {
      return [];
    }
    const room = building.value.roomById[node.room];
    return [
      {
        kind: "door",
        toRoomId: node.room,
        doorId: node.door,
        label: "through the door",
        toName: room?.name ?? node.room,
      },
    ];
  }
  if (!indoor.currentRoom) return [];
  const passableIds = new Set(
    indoorMoves.value.filter((m) => !m.onSpiral).map((m) => m.toRoomId),
  );
  return movesFrom(
    building.value,
    indoor.currentRoom,
    indoor.level,
    indoor.doorState,
    indoorVisibility.value,
    { includeBarge: true },
  ).filter((m) => !passableIds.has(m.toRoomId));
});
const reachableRooms = computed(() => {
  if (indoor.exteriorNode) {
    const ids = indoorMoves.value
      .filter((m) => m.kind === "door")
      .map((m) => m.toRoomId);
    for (const m of bargeMoves.value) ids.push(m.toRoomId);
    return ids;
  }
  return [
    ...indoorMoves.value.filter((m) => !m.onSpiral).map((m) => m.toRoomId),
    ...bargeMoves.value.map((m) => m.toRoomId),
  ];
});
const reachableExteriorNodes = computed(() => {
  if (indoor.exteriorNode) {
    return exteriorMovesFrom(building.value, indoor.exteriorNode).map(
      (m) => m.toNodeId,
    );
  }
  if (indoor.currentRoom) {
    return exteriorStepOutMoves(
      building.value,
      indoor.currentRoom,
      indoor.doorState,
      building.value.areaId,
    ).map((m) => m.toExteriorNode);
  }
  return [];
});
const nearbyDoors = computed(() => {
  if (indoor.exteriorNode) {
    const node = currentExteriorNode.value;
    if (!node?.door) return [];
    const door = building.value.doorById[node.door];
    if (!door || !isDoorMapped(door, indoorVisibility.value)) return [];
    const room = building.value.roomById[node.room];
    return [
      {
        doorId: node.door,
        toRoomId: node.room,
        toName: room?.name ?? node.room,
      },
    ];
  }
  return doorsFromRoom(building.value, indoor.currentRoom).filter((d) =>
    isDoorMapped(building.value.doorById[d.doorId], indoorVisibility.value),
  );
});
const interactableDoorIds = computed(() => {
  if (builderView.value) {
    return (building.value.doors ?? []).map((d) => d.id).filter(Boolean);
  }
  return nearbyDoors.value.map((d) => d.doorId);
});
const reachableExitDoors = computed(() => {
  if (builderView.value) {
    return (building.value.exits ?? []).map((e) => e.door);
  }
  if (indoor.exteriorNode) {
    return (building.value.exits ?? []).map((e) => e.door).filter(Boolean);
  }
  return (building.value.exits ?? [])
    .filter((exit) =>
      canUseExteriorExit(
        building.value,
        exit,
        indoor.currentRoom,
        indoor.doorState,
        building.value.areaId,
        indoor.exteriorNode,
      ),
    )
    .filter((exit) =>
      isDoorMapped(building.value.doorById[exit.door], indoorVisibility.value),
    )
    .map((exit) => exit.door);
});
const levelsTopDown = computed(() => building.value.levels);

/** Door + exit available to leave for the hex travel map. */
const worldMapExit = computed(() => {
  for (const doorId of reachableExitDoors.value) {
    const exit = building.value.exitByDoorId?.[doorId];
    if (!exit) continue;
    return { doorId, label: "Travel world map ⬡" };
  }
  return null;
});

function doorStateFor(doorId) {
  return getDoorState(indoor.doorState, building.value.areaId, doorId);
}

/** Lock side is based on interior room only — not exterior footpath nodes (they tag the door's room, not where you stand). */
const playerRoomId = computed(() => indoor.currentRoom ?? null);

const carriedItems = computed(() =>
  inventoryItems(indoor.inventory, building.value.itemById),
);

const roomPickups = computed(() => {
  const roomId = indoor.currentRoom;
  if (!roomId) return [];
  return (building.value.pickups ?? []).filter(
    (p) => p.room === roomId && !indoor.pickupsTaken.has(p.id),
  );
});

const roomSwitches = computed(() => {
  const roomId = indoor.currentRoom;
  if (!roomId) return [];
  return (building.value.switches ?? []).filter((s) => s.room === roomId);
});

function doorLockCheck(doorId) {
  const door = building.value.doorById[doorId];
  return canToggleLockFromRoom(
    indoor.doorState,
    building.value,
    building.value.areaId,
    doorId,
    playerRoomId.value,
    indoor.inventory,
    indoor.facility,
  );
}

function canToggleDoorLock(doorId) {
  return doorLockCheck(doorId).ok;
}

function doorLockHint(doorId) {
  const door = building.value.doorById[doorId];
  return lockHintForDoor(
    door,
    playerRoomId.value,
    indoor.inventory,
    indoor.facility,
    building.value.itemById,
  );
}

function syncDoorState() {
  const next = {};
  for (const [k, v] of Object.entries(indoor.doorState)) {
    next[k] = { ...v };
  }
  indoor.doorState = next;
}

function discoverIndoorRoom(roomId) {
  indoor.discovered = new Set([...indoor.discovered, roomId]);
  const next = new Set(indoor.revealed);
  applyRevealDoorsForRoom(building.value, next, roomId);
  indoor.revealed = next;
}

function tryOpenDoor(doorId) {
  if (!setDoorOpen(indoor.doorState, building.value.areaId, doorId, true))
    return;
  syncDoorState();
  exitTravelHint.value = "";
  const next = new Set(indoor.revealed);
  applyRevealForDoor(building.value, next, doorId);
  indoor.revealed = next;
}

function tryToggleDoor(doorId) {
  const door = building.value.doorById[doorId];
  if (door && isSelfClosingDoor(door)) return;
  const state = doorStateFor(doorId);
  if (!state || state.locked) return;
  if (indoor.exteriorNode) {
    const node = currentExteriorNode.value;
    if (
      node?.door === doorId &&
      state.open &&
      node.room &&
      reachableRooms.value.includes(node.room)
    ) {
      moveToRoom(node.room);
      return;
    }
  }
  if (state.open) tryCloseDoor(doorId);
  else tryOpenDoor(doorId);
}

function openAllInteriorDoors() {
  setAllDoorsOpen(
    indoor.doorState,
    building.value.areaId,
    building.value,
    true,
  );
  syncDoorState();
  const next = new Set(indoor.revealed);
  for (const door of building.value.doors) {
    if (door.id) applyRevealForDoor(building.value, next, door.id);
  }
  indoor.revealed = next;
}

function closeAllInteriorDoors() {
  setAllDoorsOpen(
    indoor.doorState,
    building.value.areaId,
    building.value,
    false,
  );
  syncDoorState();
}

function tryCloseDoor(doorId) {
  if (!setDoorOpen(indoor.doorState, building.value.areaId, doorId, false))
    return;
  syncDoorState();
}

function tryBreakLock(doorId) {
  if (
    !breakLock(
      indoor.doorState,
      building.value.areaId,
      doorId,
      building.value,
    )
  )
    return;
  syncDoorState();
}

function tryToggleLock(doorId) {
  if (
    !toggleDoorLock(
      indoor.doorState,
      building.value.areaId,
      doorId,
      building.value,
      playerRoomId.value,
      indoor.inventory,
      indoor.facility,
    )
  )
    return;
  syncDoorState();
}

function tryPickup(pickupId) {
  const pickup = (building.value.pickups ?? []).find((p) => p.id === pickupId);
  if (!pickup || indoor.pickupsTaken.has(pickupId)) return;
  if (pickup.room !== indoor.currentRoom) return;
  addItem(indoor.inventory, pickup.item);
  indoor.pickupsTaken = new Set([...indoor.pickupsTaken, pickupId]);
}

function toggleManualRelease(doorId) {
  const sw = (building.value.switches ?? []).find((s) => s.door === doorId);
  if (!sw || sw.room !== indoor.currentRoom) return;
  const next = { ...indoor.facility.manualMode };
  const engaging = !next[doorId];
  next[doorId] = engaging;
  indoor.facility.manualMode = next;
  if (engaging) {
    applyEnablerAutoUnlock(
      indoor.doorState,
      building.value,
      building.value.areaId,
      indoor.facility,
    );
  } else {
    relockEnablerDoor(
      indoor.doorState,
      building.value,
      building.value.areaId,
      doorId,
    );
  }
  syncDoorState();
}

/** Called when the hydro sim brings the generator online. */
function setHydroOnline(on) {
  indoor.facility.hydroOnline = on;
  applyEnablerAutoUnlock(
    indoor.doorState,
    building.value,
    building.value.areaId,
    indoor.facility,
  );
  syncDoorState();
}

function goIndoors() {
  outdoorStand.value = null;
  indoor.exteriorNode = building.value.exterior?.entry ?? null;
  indoor.currentRoom = null;
  indoor.discovered = new Set();
  indoor.revealed = new Set();
  indoor.level = building.value.exterior?.level ?? "first";
  indoor.viewLevel = indoor.level;
  place.value = "indoors";
}

function enterBuilding(hexId) {
  const id = hexId ?? state.currentId;
  const hex = hexById.value[id];
  if (!hex || hex.area !== "utility") return;
  goIndoors();
}

/** Dev shortcut — jump to the utility station without walking the hex map. */
function visitStation() {
  const hexId =
    building.value.outdoorHex ??
    editableHexes.value.find((h) => h.area === "utility")?.id;
  if (!hexId) return;
  state.currentId = hexId;
  state.discovered.add(hexId);
  goIndoors();
}
function exitViaDoor(doorId) {
  if (builderView.value) return;
  const exit = building.value.exitByDoorId?.[doorId];
  if (!exit) return;
  if (
    !canUseExteriorExit(
      building.value,
      exit,
      indoor.currentRoom,
      indoor.doorState,
      building.value.areaId,
      indoor.exteriorNode,
    )
  ) {
    exitTravelHint.value = indoor.exteriorNode
      ? ""
      : "Open the exterior door first, then use the ⬡ map marker.";
    return;
  }
  exitTravelHint.value = "";
  const hexId = exit.hex ?? building.value.outdoorHex;
  if (!hexId) return;
  state.currentId = hexId;
  state.discovered = new Set([...state.discovered, hexId]);
  // Use the hex's standAt from map.yaml (not per-exit overrides).
  outdoorStand.value = null;
  indoor.exteriorNode = null;
  indoor.currentRoom = null;
  place.value = "outdoors";
}
function exitBuilding() {
  const hexId = building.value.outdoorHex ?? state.currentId;
  state.currentId = hexId;
  state.discovered = new Set([...state.discovered, hexId]);
  outdoorStand.value = null;
  indoor.exteriorNode = null;
  indoor.currentRoom = null;
  place.value = "outdoors";
}

function applyIndoorMove(move) {
  if (indoor.moving) return;
  if (!indoorMoves.value.some((m) => moveKey(m) === moveKey(move))) return;

  indoor.moving = true;

  if (indoor.exteriorNode) {
    if (move.toExteriorNode) {
      indoor.exteriorNode = move.toExteriorNode;
      setTimeout(() => {
        indoor.moving = false;
      }, 400);
      return;
    }
    if (move.kind === "door" && move.toRoomId) {
      indoor.currentRoom = move.toRoomId;
      indoor.exteriorNode = null;
      discoverIndoorRoom(move.toRoomId);
      indoor.level =
        building.value.roomById[move.toRoomId]?.level ?? indoor.level;
      indoor.viewLevel = indoor.level;
      setTimeout(() => {
        indoor.moving = false;
      }, 400);
      return;
    }
    indoor.moving = false;
    return;
  }

  if (move.toExteriorNode) {
    indoor.exteriorNode = move.toExteriorNode;
    indoor.currentRoom = null;
    setTimeout(() => {
      indoor.moving = false;
    }, 400);
    return;
  }

  if (move.onSpiral) {
    indoor.level = move.toLevel;
    indoor.viewLevel = move.toLevel;
    setTimeout(() => {
      indoor.moving = false;
    }, 500);
    return;
  }

  const from = building.value.roomById[indoor.currentRoom];
  const to = building.value.roomById[move.toRoomId];
  if (!to) {
    indoor.moving = false;
    return;
  }

  indoor.currentRoom = move.toRoomId;
  discoverIndoorRoom(move.toRoomId);

  if (to.feature) {
    indoor.level = move.toLevel ?? from.level ?? from.levels?.[0];
  } else {
    indoor.level = move.toLevel ?? to.level ?? to.levels?.[0];
  }
  indoor.viewLevel = indoor.level;

  setTimeout(() => {
    indoor.moving = false;
  }, 500);
}

function moveToRoom(roomId) {
  let move = indoorMoves.value.find(
    (m) => !m.onSpiral && m.toRoomId === roomId,
  );
  if (!move) {
    const barge = bargeMoves.value.find((m) => m.toRoomId === roomId);
    if (!barge) return;
    if (barge.doorId) tryOpenDoor(barge.doorId);
    move = indoorMoves.value.find(
      (m) => !m.onSpiral && m.toRoomId === roomId,
    );
  }
  if (move) applyIndoorMove(move);
}

function moveToExteriorNode(nodeId) {
  const move = indoorMoves.value.find((m) => m.toExteriorNode === nodeId);
  if (move) applyIndoorMove(move);
}

function resetIndoor() {
  indoor.exteriorNode = building.value.exterior?.entry ?? null;
  indoor.currentRoom = null;
  indoor.discovered = new Set();
  indoor.revealed = new Set();
  indoor.level = building.value.exterior?.level ?? "first";
  indoor.viewLevel = indoor.level;
  indoor.doorState = buildInitialDoorState(
    building.value.areaId,
    building.value,
  );
  indoor.inventory = createInventory();
  indoor.pickupsTaken = new Set();
  indoor.facility.hydroOnline = false;
  indoor.facility.manualMode = {};
}
</script>

<template>
  <Analytics />
  <main>
    <header>
      <h1>Atomic Adventures — Travel Map Prototype</h1>
      <p class="sub">
        Follow the marked routes (or strike off-road). Unexplored hexes stay
        hidden, but a path may hint at what lies beyond.
      </p>
    </header>

    <section v-if="place === 'outdoors'" class="stage" :class="{ expanded }">
      <HexMap
        :map-data="displayMapData"
        :route-models="routeModels"
        :feature-models="featureModels"
        :current-hex="state.currentId"
        :discovered="discoveredList"
        :mode="mode"
        :expanded="expanded"
        :builder-view="builderView"
        :builder-edit="builderEdit"
        :edit-mode="editMode"
        :edit-handles="editHandles"
        :edit-kind="editParsed?.line?.kind ?? 'path'"
        :selected-handle-id="selectedHandleId"
        :add-point-mode="addPointMode"
        :stand-override="outdoorStand"
        @hex-click="moveTo"
        @building-enter="enterBuilding"
        @select-handle="onSelectHandle"
        @waypoint-move="onWaypointMove"
        @builder-map-click="onBuilderMapClick" />
    </section>

    <section v-if="place === 'outdoors'" class="hud">
      <div class="location">
        <span class="label">Location</span>
        <strong>{{
          currentHexData.landmark?.name ?? currentHexData.id
        }}</strong>
        <em v-if="currentHexData.landmark?.blurb">
          {{ currentHexData.landmark.blurb }}
        </em>
        <p v-if="atGatePuzzle" class="puzzle-hint">
          Puzzle — find a way through the gate to continue.
        </p>
        <p v-if="atBuildingEntrance" class="puzzle-hint">
          Click the utility station on the map to go inside.
        </p>
        <button
          v-if="atBuildingEntrance"
          class="enter-btn"
          @click="enterBuilding()">
          Enter the {{ building.name }} 🚪
        </button>
      </div>

      <div class="travel">
        <span class="label">Follow a route</span>
        <div class="options">
          <button
            v-for="m in moves"
            :key="m.routeId + m.toHexId"
            class="route-btn"
            :class="'k-' + m.kind"
            :disabled="traveling"
            @click="moveTo(m.toHexId)">
            Take {{ m.routeName }} {{ m.label }}
            <span class="dest">→ {{ nameOf(m.toHexId) }}</span>
          </button>
          <button
            v-for="o in offRoad"
            :key="'off-' + o.toHexId"
            class="route-btn off"
            :disabled="traveling"
            @click="moveTo(o.toHexId)">
            Go off-road {{ o.label }}
            <span class="dest">→ ?</span>
          </button>
        </div>
      </div>

      <div class="controls">
        <button class="visit-station-btn" @click="visitStation">
          Visit {{ building.name }} 🏭
        </button>
        <button :disabled="traveling" @click="autoTravel">
          Auto-travel main path ⏩
        </button>
        <button @click="reset">Reset</button>
        <button @click="expanded = !expanded">
          {{ expanded ? "Collapse map" : "Expand map ⤢" }}
        </button>
      </div>

      <div class="modes">
        <span class="label">View</span>
        <label
          v-for="vm in ['slice', 'explored', 'full']"
          :key="vm"
          class="mode-pill"
          :class="{ active: mode === vm }">
          <input type="radio" :value="vm" v-model="mode" />
          {{ vm }}
        </label>
        <label class="mode-pill builder-pill" :class="{ active: builderView }">
          <input type="checkbox" v-model="builderView" />
          builder
        </label>
      </div>

      <div v-if="builderView" class="builder-panel">
        <span class="label">Edit</span>
        <select v-model="editSelection" class="builder-select">
          <optgroup label="Buildings &amp; stands">
            <option
              v-for="item in editableItems.filter((l) => l.source === 'hexes')"
              :key="item.id"
              :value="`${item.source}:${item.id}`">
              {{ item.label }}
            </option>
          </optgroup>
          <optgroup label="Routes">
            <option
              v-for="line in editableItems.filter((l) => l.source === 'routes')"
              :key="line.id"
              :value="`${line.source}:${line.id}`">
              {{ line.label }} ({{ line.kind }})
            </option>
          </optgroup>
          <optgroup label="Features">
            <option
              v-for="line in editableItems.filter(
                (l) => l.source === 'features',
              )"
              :key="line.id"
              :value="`${line.source}:${line.id}`">
              {{ line.label }} ({{ line.kind }})
            </option>
          </optgroup>
        </select>

        <div v-if="editMode === 'line'" class="builder-actions">
          <label
            class="mode-pill sm"
            :class="{ active: editParsed?.line?.smooth }">
            <input
              type="checkbox"
              :checked="editParsed?.line?.smooth"
              @change="toggleSmooth" />
            smooth curve
          </label>
          <label class="mode-pill sm" :class="{ active: addPointMode }">
            <input type="checkbox" v-model="addPointMode" />
            click to add point
          </label>
          <button
            class="sm"
            :disabled="!selectedHandleId?.startsWith('point-')"
            @click="deleteSelectedPoint">
            Delete point
          </button>
        </div>

        <div v-if="editMode === 'placement'" class="builder-actions">
          <label
            v-if="hasLandmarkMarker(editParsed?.hex)"
            class="mode-pill sm"
            :class="{ active: standAnchoredToLandmark }">
            <input
              type="checkbox"
              :checked="standAnchoredToLandmark"
              @change="toggleStandAnchor" />
            stand follows building
          </label>
        </div>

        <p class="builder-hint builder-export-note">
          Paste each section into <code>map.yaml</code>, replacing the matching
          block (<code>hexes:</code>, <code>features:</code>, or
          <code>routes:</code>). Copy hexes replaces the <em>entire</em> hex
          list — save the file and the map reloads automatically.
        </p>

        <p class="builder-hint">
          <template v-if="editMode === 'placement'">
            <span class="handle-key landmark">●</span> purple = building icon —
            <span class="handle-key stand">●</span> green = player stand. Drag
            to reposition; enable “stand follows building” so the player stays
            beside the icon when you move it.
          </template>
          <template v-else-if="editMode === 'line'">
            Drag yellow handles to reshape the line. Dashed guide = control
            points; solid stroke uses smoothing when enabled.
            <template v-if="editHandles.length">
              {{ editHandles.length }} points
              <template v-if="selectedHandleId">
                — selected {{ selectedHandleId }}
              </template>
            </template>
          </template>
        </p>

        <div class="builder-export">
          <span class="label">Export</span>
          <div class="export-btns">
            <button class="sm" @click="copyYaml('hexes')">Copy hexes</button>
            <button class="sm" @click="copyYaml('features')">
              Copy features
            </button>
            <button class="sm" @click="copyYaml('routes')">Copy routes</button>
            <button class="sm" @click="copyYaml('both')">Copy all</button>
            <button class="sm" @click="downloadYaml">Download</button>
            <button class="sm muted" @click="resetMapBuilder">Reset</button>
          </div>
          <p v-if="exportStatus" class="export-status">{{ exportStatus }}</p>
        </div>
      </div>

      <p class="progress">
        Discovered {{ discoveredList.length }} /
        {{ mapData.hexes.length }} hexes
      </p>
    </section>

    <!-- ===================== INDOORS ===================== -->
    <div
      v-if="place === 'indoors' && builderView"
      class="grid-builder-workspace">
      <section class="stage builder-stage">
        <GridMap
          :building="building"
          :current-room="indoor.currentRoom ?? ''"
          :exterior-node="indoor.exteriorNode"
          :discovered="[...indoor.discovered]"
          :revealed="[...indoor.revealed]"
          :level="indoor.viewLevel"
          :stand-level="indoor.level"
          :reachable-rooms="reachableRooms"
          :reachable-exterior-nodes="reachableExteriorNodes"
          :door-states="indoor.doorState"
          :builder-view="builderView"
          :builder-edit="gridBuilderEdit"
          :edit-mode="gridEditMode"
          :edit-handles="gridEditHandles"
          :selected-handle-id="gridSelectedHandleId"
          :selected-item-id="gridEditParsed?.id ?? ''"
          :add-point-mode="gridAddPointMode"
          :expanded="expanded"
          :interactable-door-ids="interactableDoorIds"
          :reachable-exit-doors="reachableExitDoors"
          @room-click="moveToRoom"
          @exterior-node-click="moveToExteriorNode"
          @door-click="tryToggleDoor"
          @exit-click="exitViaDoor"
          @select-handle="gridSelectedHandleId = $event"
          @grid-handle-move="onGridHandleMove"
          @builder-map-click="onGridBuilderMapClick"
          @select-item="onGridSelectItem" />
      </section>

      <aside class="builder-sidebar builder-panel">
        <span class="label">Grid builder</span>
        <select v-model="gridEditSelection" class="builder-select">
          <optgroup label="Paths">
            <option
              v-for="item in gridEditableItems.filter(
                (i) => i.source === 'paths',
              )"
              :key="item.id"
              :value="`${item.source}:${item.id}`">
              {{ item.label }}
            </option>
          </optgroup>
          <optgroup label="Rooms">
            <option
              v-for="item in gridEditableItems.filter(
                (i) => i.source === 'rooms',
              )"
              :key="item.id"
              :value="`${item.source}:${item.id}`">
              {{ item.label }}
            </option>
          </optgroup>
          <optgroup label="Doors">
            <option
              v-for="item in gridEditableItems.filter(
                (i) => i.source === 'doors',
              )"
              :key="item.id"
              :value="`${item.source}:${item.id}`">
              {{ item.label }}
            </option>
          </optgroup>
          <optgroup label="Nodes">
            <option
              v-for="item in gridEditableItems.filter(
                (i) => i.source === 'nodes',
              )"
              :key="item.id"
              :value="`${item.source}:${item.id}`">
              {{ item.label }}
            </option>
          </optgroup>
          <optgroup label="World map exits">
            <option
              v-for="item in gridEditableItems.filter(
                (i) => i.source === 'exits',
              )"
              :key="item.id"
              :value="`${item.source}:${item.id}`">
              {{ item.label }}
            </option>
          </optgroup>
        </select>

        <div v-if="gridEditMode === 'line'" class="builder-actions">
          <label
            class="mode-pill sm"
            :class="{ active: gridEditParsed?.entity?.smooth }">
            <input
              type="checkbox"
              :checked="gridEditParsed?.entity?.smooth"
              @change="toggleGridSmooth" />
            smooth curve
          </label>
          <label class="mode-pill sm" :class="{ active: gridAddPointMode }">
            <input type="checkbox" v-model="gridAddPointMode" />
            click to add point
          </label>
          <button
            class="sm"
            :disabled="!gridSelectedHandleId?.startsWith('point-')"
            @click="deleteGridSelectedPoint">
            Delete point
          </button>
        </div>

        <div v-if="gridEditMode === 'room'" class="builder-props">
          <label class="prop-row">
            <span>Name</span>
            <input
              type="text"
              :value="gridEditParsed?.entity?.name ?? ''"
              @input="
                setRoomName(
                  editableBuildingData,
                  gridEditParsed.id,
                  $event.target.value,
                )
              " />
          </label>
          <label class="prop-row">
            <span>X</span>
            <input
              type="number"
              step="0.5"
              :value="gridEditParsed?.entity?.x"
              @input="
                setRoomRect(editableBuildingData, gridEditParsed.id, {
                  x: Number($event.target.value),
                })
              " />
          </label>
          <label class="prop-row">
            <span>Y</span>
            <input
              type="number"
              step="0.5"
              :value="gridEditParsed?.entity?.y"
              @input="
                setRoomRect(editableBuildingData, gridEditParsed.id, {
                  y: Number($event.target.value),
                })
              " />
          </label>
          <label class="prop-row">
            <span>W</span>
            <input
              type="number"
              step="0.5"
              min="0.5"
              :value="gridEditParsed?.entity?.w"
              @input="
                setRoomRect(editableBuildingData, gridEditParsed.id, {
                  w: Number($event.target.value),
                })
              " />
          </label>
          <label class="prop-row">
            <span>H</span>
            <input
              type="number"
              step="0.5"
              min="0.5"
              :value="gridEditParsed?.entity?.h"
              @input="
                setRoomRect(editableBuildingData, gridEditParsed.id, {
                  h: Number($event.target.value),
                })
              " />
          </label>
          <p class="prop-readonly">ID: {{ gridEditParsed?.id }}</p>
        </div>

        <div
          v-if="gridEditMode === 'door' && gridEditParsed?.entity?.kind === 'man'"
          class="builder-props">
          <label class="prop-row">
            <span>X</span>
            <input
              type="number"
              step="0.05"
              :value="gridEditParsed?.entity?.at?.x"
              @input="
                setDoorAt(
                  editableBuildingData,
                  gridEditParsed.id,
                  Number($event.target.value),
                  gridEditParsed.entity.at?.y ?? 0,
                )
              " />
          </label>
          <label class="prop-row">
            <span>Y</span>
            <input
              type="number"
              step="0.05"
              :value="gridEditParsed?.entity?.at?.y"
              @input="
                setDoorAt(
                  editableBuildingData,
                  gridEditParsed.id,
                  gridEditParsed.entity.at?.x ?? 0,
                  Number($event.target.value),
                )
              " />
          </label>
          <label class="prop-row checkbox">
            <input
              type="checkbox"
              :checked="gridEditParsed?.entity?.vertical"
              @change="
                (gridEditParsed.entity.vertical = $event.target.checked)
              " />
            vertical
          </label>
          <p class="prop-readonly">ID: {{ gridEditParsed?.id }}</p>
        </div>

        <div
          v-if="gridEditMode === 'door' && gridEditParsed?.entity?.kind === 'roll'"
          class="builder-props">
          <p class="prop-readonly">Room: {{ gridEditParsed?.entity?.room }}</p>
          <label class="prop-row">
            <span>Edge</span>
            <select
              :value="gridRollDoorRoom?.rollDoor ?? 'right'"
              @change="
                setRollDoorProps(editableBuildingData, gridEditParsed.id, {
                  edge: $event.target.value,
                })
              ">
              <option value="top">top</option>
              <option value="bottom">bottom</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </label>
          <label class="prop-row">
            <span>Span</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              :value="gridRollDoorRoom?.rollSpan ?? 0.6"
              @input="
                setRollDoorProps(editableBuildingData, gridEditParsed.id, {
                  rollSpan: Number($event.target.value),
                })
              " />
            <span class="prop-value">{{
              (gridRollDoorRoom?.rollSpan ?? 0.6).toFixed(2)
            }}</span>
          </label>
          <p class="prop-readonly">ID: {{ gridEditParsed?.id }}</p>
        </div>

        <div v-if="gridEditMode === 'node'" class="builder-props">
          <label class="prop-row">
            <span>Label</span>
            <input
              type="text"
              :value="gridEditParsed?.entity?.label ?? ''"
              @input="
                setNodeLabel(
                  editableBuildingData,
                  gridEditParsed.id,
                  $event.target.value,
                )
              " />
          </label>
          <label class="prop-row">
            <span>X</span>
            <input
              type="number"
              step="0.05"
              :value="gridEditParsed?.entity?.at?.x"
              @input="
                setNodeAt(
                  editableBuildingData,
                  gridEditParsed.id,
                  Number($event.target.value),
                  gridEditParsed.entity.at?.y ?? 0,
                )
              " />
          </label>
          <label class="prop-row">
            <span>Y</span>
            <input
              type="number"
              step="0.05"
              :value="gridEditParsed?.entity?.at?.y"
              @input="
                setNodeAt(
                  editableBuildingData,
                  gridEditParsed.id,
                  gridEditParsed.entity.at?.x ?? 0,
                  Number($event.target.value),
                )
              " />
          </label>
          <p class="prop-readonly">ID: {{ gridEditParsed?.id }}</p>
        </div>

        <div v-if="gridEditMode === 'exit'" class="builder-props">
          <p class="prop-readonly">
            Door: {{ gridEditParsed?.entity?.door }} · anchor
            {{ gridEditParsed?.entity?.at?.x }},
            {{ gridEditParsed?.entity?.at?.y }}
          </p>
          <label class="prop-row">
            <span>Map X</span>
            <input
              type="number"
              step="0.05"
              :value="getExitMapAt(gridEditParsed?.entity).x"
              @input="
                setExitMapAt(
                  editableBuildingData,
                  gridEditParsed.id,
                  Number($event.target.value),
                  getExitMapAt(gridEditParsed.entity).y,
                )
              " />
          </label>
          <label class="prop-row">
            <span>Map Y</span>
            <input
              type="number"
              step="0.05"
              :value="getExitMapAt(gridEditParsed?.entity).y"
              @input="
                setExitMapAt(
                  editableBuildingData,
                  gridEditParsed.id,
                  getExitMapAt(gridEditParsed.entity).x,
                  Number($event.target.value),
                )
              " />
          </label>
          <button
            v-if="gridEditParsed?.entity?.mapAt"
            class="sm muted"
            @click="gridEditParsed.entity.mapAt = undefined">
            Reset to default offset
          </button>
        </div>

        <div class="builder-actions playtest">
          <span class="label">Playtest</span>
          <button class="sm" @click="openAllInteriorDoors">Open all doors</button>
          <button class="sm" @click="closeAllInteriorDoors">
            Close all doors
          </button>
        </div>

        <p class="builder-hint">
          <template v-if="gridEditMode === 'line'">
            Drag yellow handles for curve points, green for named path nodes
            (stand spots). Moving a node updates matching path points and exits.
          </template>
          <template v-else-if="gridEditMode === 'room'">
            Drag purple center to move; yellow corners to resize. Click a room
            on the map to select it.
          </template>
          <template v-else-if="gridEditMode === 'door'">
            <template v-if="gridEditParsed?.entity?.kind === 'man'">
              Drag the green handle to reposition the man door.
            </template>
            <template v-else>
              Adjust roll-up edge and span in the panel — position follows room
              geometry.
            </template>
          </template>
          <template v-else-if="gridEditMode === 'node'">
            Drag the green handle to move an exterior stand spot.
          </template>
          <template v-else-if="gridEditMode === 'exit'">
            Click the ⬡ marker to select it, then drag the green handle (or edit
            Map X/Y). Exits do not leave the building while builder is on.
          </template>
        </p>

        <p class="builder-hint builder-export-note">
          Paste each section into
          <code>utility-station.yaml</code>, replacing the matching block.
          Save the file and the map reloads automatically.
        </p>

        <div class="builder-export">
          <span class="label">Export</span>
          <div class="export-btns">
            <button class="sm" @click="copyGridYaml('rooms')">Copy rooms</button>
            <button class="sm" @click="copyGridYaml('doors')">Copy doors</button>
            <button class="sm" @click="copyGridYaml('exits')">Copy exits</button>
            <button class="sm" @click="copyGridYaml('exterior')">
              Copy exterior
            </button>
            <button class="sm" @click="copyGridYaml('all')">Copy all</button>
            <button class="sm" @click="downloadGridYaml">Download</button>
            <button class="sm muted" @click="resetGridBuilder">Reset</button>
          </div>
          <p v-if="gridExportStatus" class="export-status">
            {{ gridExportStatus }}
          </p>
        </div>
      </aside>
    </div>

    <section
      v-else-if="place === 'indoors'"
      class="stage"
      :class="{ expanded }">
      <GridMap
        :building="building"
        :current-room="indoor.currentRoom ?? ''"
        :exterior-node="indoor.exteriorNode"
        :discovered="[...indoor.discovered]"
        :revealed="[...indoor.revealed]"
        :level="indoor.viewLevel"
        :stand-level="indoor.level"
        :reachable-rooms="reachableRooms"
        :reachable-exterior-nodes="reachableExteriorNodes"
        :door-states="indoor.doorState"
        :builder-view="builderView"
        :expanded="expanded"
        :interactable-door-ids="interactableDoorIds"
        :reachable-exit-doors="reachableExitDoors"
        @room-click="moveToRoom"
        @exterior-node-click="moveToExteriorNode"
        @door-click="tryToggleDoor"
        @exit-click="exitViaDoor" />
    </section>

    <section v-if="place === 'indoors'" class="hud">
      <div class="location">
        <span class="label">{{ building.name }}</span>
        <strong>{{
          currentExteriorNode?.label ??
          currentRoomData?.name ??
          currentRoomData?.id
        }}</strong>
        <em v-if="currentRoomData?.blurb">{{ currentRoomData.blurb }}</em>
        <em v-else-if="currentExteriorNode"
          >Walk the footpath — click green dots to move. Any ⬡ map marker (or
          the button below) takes you to the hex travel map.</em
        >
        <button
          v-if="worldMapExit && !builderView"
          class="world-map-btn"
          @click="exitViaDoor(worldMapExit.doorId)">
          {{ worldMapExit.label }}
        </button>
        <p
          v-else-if="!indoor.exteriorNode && reachableExitDoors.length && !worldMapExit"
          class="puzzle-hint">
          Open an exterior door to unlock travel to the world map.
        </p>
        <p
          v-if="!indoor.exteriorNode && reachableExitDoors.length && indoor.currentRoom"
          class="puzzle-hint">
          Open the exterior door, then step out to the footpath (Move or green
          dot) or use the ⬡ map marker for the world map.
        </p>
        <p v-if="exitTravelHint" class="puzzle-hint">{{ exitTravelHint }}</p>
      </div>

      <div class="travel">
        <span class="label">Move</span>
        <div class="options">
          <button
            v-for="m in indoorMoves"
            :key="moveKey(m)"
            class="route-btn"
            :class="
              'k-' +
              (m.kind === 'door' ? 'path' : m.kind === 'path' ? 'trail' : 'road')
            "
            :disabled="indoor.moving"
            @click="applyIndoorMove(m)">
            Go {{ m.label }}
            <span class="dest"
              >→
              {{
                m.toExteriorNode
                  ? m.toName
                  : m.onSpiral || isDestinationNamed(m.toRoomId, indoorVisibility)
                    ? m.toName
                    : "?"
              }}</span
            >
          </button>
        </div>
      </div>

      <div v-if="carriedItems.length" class="inventory">
        <span class="label">Carrying</span>
        <ul class="inventory-list">
          <li v-for="item in carriedItems" :key="item.id">
            <strong>{{ item.name }}</strong>
            <em v-if="item.description">{{ item.description }}</em>
          </li>
        </ul>
      </div>

      <div v-if="roomPickups.length && !builderView" class="pickups">
        <span class="label">Found here</span>
        <div v-for="p in roomPickups" :key="p.id" class="pickup-row">
          <button class="sm" @click="tryPickup(p.id)">Take — {{ p.label }}</button>
        </div>
      </div>

      <div v-if="roomSwitches.length && !builderView" class="switches">
        <span class="label">Garage controls</span>
        <div v-for="sw in roomSwitches" :key="sw.id" class="switch-row">
          <button class="sm" @click="toggleManualRelease(sw.door)">
            {{
              isManualEnablerActive(sw.door, indoor.facility)
                ? "Engage motor"
                : sw.label
            }}
          </button>
        </div>
      </div>

      <div v-if="nearbyDoors.length" class="doors">
        <span class="label">Doors</span>
        <div v-for="d in nearbyDoors" :key="d.doorId" class="door-row">
          <span class="door-name">
            {{ doorLabel(building, d.doorId, d.toName) }}
            <em class="door-state">{{
              doorStatusText(
                doorStateFor(d.doorId),
                building.doorById[d.doorId],
                indoor.facility,
              )
            }}</em>
            <em v-if="doorLockHint(d.doorId)" class="door-hint">{{
              doorLockHint(d.doorId)
            }}</em>
          </span>
          <span
            v-if="!isSelfClosingDoor(building.doorById[d.doorId])"
            class="door-actions">
            <button
              v-if="
                canBreakLock(
                  indoor.doorState,
                  building.areaId,
                  d.doorId,
                  building,
                )
              "
              class="sm"
              @click="tryBreakLock(d.doorId)">
              Break lock
            </button>
            <button
              v-if="
                !isEnablerLock(building.doorById[d.doorId]) &&
                (canToggleLock(
                  indoor.doorState,
                  building.areaId,
                  d.doorId,
                  building,
                  playerRoomId,
                  indoor.inventory,
                  indoor.facility,
                ) ||
                  doorStateFor(d.doorId).locked)
              "
              class="sm"
              :disabled="!canToggleDoorLock(d.doorId)"
              :title="
                canToggleDoorLock(d.doorId)
                  ? ''
                  : doorLockHint(d.doorId) || 'Cannot change lock'
              "
              @click="tryToggleLock(d.doorId)">
              {{ doorStateFor(d.doorId).locked ? "Unlock" : "Lock" }}
            </button>
            <button
              v-if="
                canOpenDoor(indoor.doorState, building.areaId, d.doorId) ||
                canCloseDoor(indoor.doorState, building.areaId, d.doorId)
              "
              class="sm"
              @click="tryToggleDoor(d.doorId)">
              {{ doorStateFor(d.doorId).open ? "Close" : "Open" }}
            </button>
          </span>
        </div>
      </div>

      <div class="modes">
        <span class="label">Floor</span>
        <label
          v-for="lv in levelsTopDown"
          :key="lv.id"
          class="mode-pill"
          :class="{ active: indoor.viewLevel === lv.id }">
          <input type="radio" :value="lv.id" v-model="indoor.viewLevel" />
          {{ lv.name }}
        </label>
        <label class="mode-pill builder-pill" :class="{ active: builderView }">
          <input type="checkbox" v-model="builderView" />
          builder
        </label>
      </div>

      <div class="controls">
        <button @click="exitBuilding">← Step outside</button>
        <button @click="resetIndoor">Reset</button>
        <button @click="expanded = !expanded">
          {{ expanded ? "Collapse map" : "Expand map ⤢" }}
        </button>
      </div>

      <p class="progress">
        Explored {{ indoor.discovered.size }} /
        {{ building.rooms.length }} rooms
      </p>
    </section>
  </main>
</template>

<style scoped>
main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
header h1 {
  font-size: 1.4rem;
  margin: 0 0 0.25rem;
}
.sub {
  color: #9aa0ac;
  margin: 0 0 1.5rem;
  font-size: 0.92rem;
}
.stage {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}
.stage.expanded {
  display: block;
}
.grid-builder-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) min(320px, 28%);
  gap: 1rem;
  align-items: start;
  margin-bottom: 1.5rem;
}
.builder-stage {
  min-width: 0;
}
.builder-sidebar {
  max-height: min(58vh, 560px);
  overflow-y: auto;
}
@media (max-width: 720px) {
  .grid-builder-workspace {
    grid-template-columns: 1fr;
  }
  .builder-sidebar {
    max-height: none;
  }
}
.builder-props {
  display: grid;
  gap: 0.45rem;
}
.prop-row {
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.85rem;
  color: #c5cad3;
}
.prop-row.checkbox {
  grid-template-columns: auto 1fr;
}
.prop-row input[type="text"],
.prop-row input[type="number"],
.prop-row select {
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 4px;
  padding: 0.3rem 0.45rem;
  font-size: 0.85rem;
}
.prop-readonly {
  margin: 0;
  font-size: 0.78rem;
  color: #6f7787;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.prop-value {
  font-size: 0.78rem;
  color: #9aa0ac;
}
.builder-actions.playtest {
  flex-direction: column;
  align-items: stretch;
}
.hud {
  display: grid;
  gap: 1rem;
  background: #20242d;
  border: 1px solid #2f3540;
  border-radius: 12px;
  padding: 1.25rem;
}
.location {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.location strong {
  font-size: 1.1rem;
}
.location em {
  color: #9aa0ac;
  font-size: 0.88rem;
}
.puzzle-hint {
  margin: 0.35rem 0 0;
  color: #d4a84b;
  font-size: 0.9rem;
}
.enter-btn {
  margin-top: 0.6rem;
  align-self: flex-start;
  background: #3a5a3f;
  border-color: #4e7a55;
}
.enter-btn:hover {
  background: #46694c;
}
.visit-station-btn {
  background: #3a4a5a;
  border-color: #5a7088;
}
.visit-station-btn:hover {
  background: #465a6e;
}
.world-map-btn {
  margin-top: 0.6rem;
  align-self: flex-start;
  background: #3d5a4a;
  border-color: #5a8870;
}
.world-map-btn:hover {
  background: #4a7560;
}
.label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.7rem;
  color: #6f7787;
}
.travel .options {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.35rem;
}
.route-btn {
  text-align: left;
  border-left-width: 4px;
}
.route-btn.k-path {
  border-left-color: #c39a6b;
}
.route-btn.k-road {
  border-left-color: #9aa0a6;
}
.route-btn.k-trail {
  border-left-color: #d7c48f;
}
.route-btn.off {
  border-left-color: #5a6270;
  color: #aeb4c0;
  font-style: italic;
}
.dest {
  color: #7f8794;
  font-size: 0.82rem;
}
.doors {
  margin-top: 0.75rem;
}
.door-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  margin-top: 0.35rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.door-row:last-child {
  border-bottom: none;
}
.door-name {
  font-size: 0.88rem;
}
.door-state {
  color: #8b94a3;
  font-style: normal;
  margin-left: 0.35rem;
}
.door-hint {
  display: block;
  color: #6f7787;
  font-size: 0.78rem;
  margin-top: 0.15rem;
}
.inventory,
.pickups,
.switches {
  margin-top: 0.75rem;
}
.inventory-list {
  margin: 0.35rem 0 0;
  padding: 0;
  list-style: none;
}
.inventory-list li {
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
}
.inventory-list em {
  display: block;
  color: #7f8794;
  font-size: 0.78rem;
  font-style: normal;
}
.pickup-row,
.switch-row {
  margin-top: 0.35rem;
}
.controls button.active {
  background: #3d5a3a;
  border-color: #5a8a52;
}
.door-actions {
  display: flex;
  gap: 0.35rem;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
button {
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s ease;
}
button:hover:not(:disabled) {
  background: #3a4860;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.modes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.mode-pill {
  border: 1px solid #3f4c63;
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  text-transform: capitalize;
}
.mode-pill.active {
  background: #ffd166;
  color: #1a1d23;
  border-color: #ffd166;
}
.mode-pill input {
  display: none;
}
.progress {
  margin: 0;
  color: #6f7787;
  font-size: 0.85rem;
}
.builder-panel {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  background: #1a1f28;
  border: 1px solid #3a4558;
  border-radius: 8px;
}
.builder-select {
  width: 100%;
  max-width: 420px;
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.88rem;
}
.builder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.mode-pill.sm {
  font-size: 0.8rem;
  padding: 0.2rem 0.6rem;
}
button.sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.82rem;
}
button.sm.muted {
  background: #252a33;
  border-color: #3a404a;
  color: #9aa0ac;
}
.builder-hint {
  margin: 0;
  color: #8a919e;
  font-size: 0.82rem;
  line-height: 1.45;
}
.builder-export {
  display: grid;
  gap: 0.4rem;
}
.export-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.export-status {
  margin: 0;
  color: #7dcea0;
  font-size: 0.82rem;
}
.handle-key {
  font-weight: 700;
}
.handle-key.landmark {
  color: #c792ea;
}
.handle-key.stand {
  color: #7dcea0;
}
</style>
