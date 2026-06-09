import { computed, reactive, ref } from "vue";
import {
  applyRevealDoorsForRoom,
  buildBuilding,
  mapVisibilityCtx,
} from "../useGrid.js";
import { buildInitialDoorState } from "../useDoors.js";
import { createInventory, addItem, inventoryItems } from "../useInventory.js";

export function createIndoorPlayer(buildingData, builderView) {
  const editableBuildingData = ref(structuredClone(buildingData));
  const building = computed(() => buildBuilding(editableBuildingData.value));

  function syncFromBuildingData(data) {
    editableBuildingData.value = structuredClone(data);
  }

  if (import.meta.hot) {
    import.meta.hot.accept("../../../content/world/utility-station.yaml", (mod) => {
      if (mod?.default) syncFromBuildingData(mod.default);
    });
  }

  const initialBuilding = buildBuilding(buildingData);
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
      hydroOnline: false,
      manualMode: {},
    },
    moving: false,
    avatarWaypoint: null, // { x, y } layout-unit override during path animation
  });

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

  const currentRoomData = computed(() =>
    indoor.currentRoom ? building.value.roomById[indoor.currentRoom] : null,
  );

  const currentExteriorNode = computed(() =>
    indoor.exteriorNode
      ? building.value.exterior?.nodeById?.[indoor.exteriorNode]
      : null,
  );

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

  function discoverIndoorRoom(roomId) {
    indoor.discovered = new Set([...indoor.discovered, roomId]);
    const next = new Set(indoor.revealed);
    applyRevealDoorsForRoom(building.value, next, roomId);
    indoor.revealed = next;
  }

  function tryPickup(pickupId) {
    const pickup = (building.value.pickups ?? []).find((p) => p.id === pickupId);
    if (!pickup || indoor.pickupsTaken.has(pickupId)) return;
    if (pickup.room !== indoor.currentRoom) return;
    addItem(indoor.inventory, pickup.item);
    indoor.pickupsTaken = new Set([...indoor.pickupsTaken, pickupId]);
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
    indoor.avatarWaypoint = null;
  }

  return {
    editableBuildingData,
    building,
    syncFromBuildingData,
    indoor,
    exitTravelHint,
    indoorVisibility,
    currentRoomData,
    currentExteriorNode,
    playerRoomId,
    carriedItems,
    roomPickups,
    discoverIndoorRoom,
    tryPickup,
    resetIndoor,
  };
}
