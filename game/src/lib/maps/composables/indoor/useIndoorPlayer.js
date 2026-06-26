import { computed, reactive, ref } from "vue";
import {
  applyRevealDoorsForRoom,
  buildBuilding,
  defaultRoomStandId,
  mapVisibilityCtx,
  roomStandById,
} from "../useGrid.js";
import { buildInitialDoorState } from "../useDoors.js";
import { createInventory } from "../useInventory.js";
import { applyEffectsAtomically } from "../../../character/effects.js";
import { characterItems } from "../../../../composables/useCharacterState.js";
import { createFlags } from "../useFlags.js";

export function createIndoorPlayer(
  buildingData,
  builderView,
  { flags: sharedFlags, character } = {},
) {
  const flagsAreShared = !!sharedFlags;
  const inventoryIsShared = !!character;
  const editableBuildingData = ref(structuredClone(buildingData));
  const building = computed(() => buildBuilding(editableBuildingData.value));

  function syncFromBuildingData(data) {
    const nextBuilding = buildBuilding(data);
    const currentRoom = nextBuilding.roomById[indoor.currentRoom] ? indoor.currentRoom : null;
    const exteriorNode = nextBuilding.exterior?.nodeById?.[indoor.exteriorNode]
      ? indoor.exteriorNode
      : currentRoom
        ? null
        : nextBuilding.exterior?.entry ?? null;
    const currentDoorState = indoor.doorState;
    const nextDoorState = buildInitialDoorState(nextBuilding.areaId, nextBuilding);
    for (const key of Object.keys(nextDoorState)) {
      if (currentDoorState[key]) nextDoorState[key] = { ...currentDoorState[key] };
    }
    editableBuildingData.value = structuredClone(data);
    indoor.currentRoom = currentRoom;
    indoor.currentStand = currentRoom && roomStandById(
      nextBuilding,
      currentRoom,
      indoor.currentStand,
    )
      ? indoor.currentStand
      : currentRoom
        ? defaultRoomStandId(nextBuilding.roomById[currentRoom])
        : null;
    indoor.exteriorNode = exteriorNode;
    indoor.discovered = new Set(
      [...indoor.discovered].filter((id) => nextBuilding.roomById[id]),
    );
    indoor.revealed = new Set(
      [...indoor.revealed].filter((id) => {
        if (nextBuilding.roomById[id]) return true;
        if (id.startsWith("door:")) return !!nextBuilding.doorById[id.slice(5)];
        if (id.startsWith("fixture:")) {
          return nextBuilding.fixtures.some((fixture) => fixture.id === id.slice(8));
        }
        return false;
      }),
    );
    indoor.level = nextBuilding.levelById[indoor.level]
      ? indoor.level
      : nextBuilding.exterior?.level ?? nextBuilding.levels[0]?.id;
    indoor.viewLevel = nextBuilding.levelById[indoor.viewLevel]
      ? indoor.viewLevel
      : indoor.level;
    indoor.doorState = nextDoorState;
    indoor.pickupsTaken = new Set(
      [...indoor.pickupsTaken].filter((id) =>
        nextBuilding.pickups.some((pickup) => pickup.id === id),
      ),
    );
    indoor.completedActions = new Set(
      [...indoor.completedActions].filter((id) =>
        nextBuilding.actions.some((action) => action.id === id),
      ),
    );
    indoor.avatarWaypoint = null;
  }

  const initialBuilding = buildBuilding(buildingData);
  const exitTravelHint = ref("");

  const indoor = reactive({
    currentRoom: null,
    currentStand: null,
    exteriorNode: initialBuilding.exterior?.entry ?? null,
    discovered: new Set(),
    revealed: new Set(),
    level: initialBuilding.exterior?.level ?? initialBuilding.levels[0]?.id,
    viewLevel: initialBuilding.exterior?.level ?? initialBuilding.levels[0]?.id,
    doorState: buildInitialDoorState(initialBuilding.areaId, initialBuilding),
    inventory: character ? null : createInventory(),
    pickupsTaken: new Set(),
    facility: {
      hydroOnline: false,
      manualMode: {},
    },
    flags: sharedFlags ?? createFlags(),
    completedActions: new Set(),
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
    character ? characterItems(character) : [],
  );

  const roomPickups = computed(() => {
    const roomId = indoor.currentRoom;
    if (!roomId) return [];
    const catalog = Object.fromEntries(
      (character?.definitions?.items ?? []).map((item) => [item.id, item]),
    );
    return (building.value.pickups ?? [])
      .filter((p) => p.room === roomId && !indoor.pickupsTaken.has(p.id))
      .map((pickup) => ({
        ...pickup,
        label: pickup.label ?? catalog[pickup.item]?.label ?? pickup.item,
      }));
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
    if (character) {
      const result = applyEffectsAtomically(
        [{ op: "item.add", id: pickup.item, quantity: 1 }],
        { character, flags: indoor.flags },
      );
      if (!result.ok) return;
    } else {
      indoor.inventory.add(pickup.item);
    }
    indoor.pickupsTaken = new Set([...indoor.pickupsTaken, pickupId]);
  }

  function resetIndoor() {
    indoor.exteriorNode = building.value.exterior?.entry ?? null;
    indoor.currentRoom = null;
    indoor.currentStand = null;
    indoor.discovered = new Set();
    indoor.revealed = new Set();
    indoor.level = building.value.exterior?.level ?? "first";
    indoor.viewLevel = indoor.level;
    indoor.doorState = buildInitialDoorState(
      building.value.areaId,
      building.value,
    );
    if (!inventoryIsShared) indoor.inventory = createInventory();
    indoor.pickupsTaken = new Set();
    indoor.facility.hydroOnline = false;
    indoor.facility.manualMode = {};
    if (!flagsAreShared) {
      indoor.flags = createFlags();
    }
    indoor.completedActions = new Set();
    indoor.avatarWaypoint = null;
    indoor.moving = false;
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
    flagsAreShared,
    inventoryIsShared,
  };
}
