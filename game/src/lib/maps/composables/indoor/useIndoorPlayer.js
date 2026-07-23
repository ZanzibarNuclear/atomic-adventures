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
import {
  characterItems,
  markCharacterChanged,
} from "../../../../composables/useCharacterState.js";
import { createFlags } from "../useFlags.js";
import {
  characterHolderId,
  ensureWorldHolder,
  holdingRecords,
  transferHolding,
} from "../../../character/holdings.js";
import { removeItem } from "../useInventory.js";

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
      /** roomId → true when wall light switch is closed (on). */
      lightSwitches: {},
    },
    flags: sharedFlags ?? createFlags(),
    completedActions: new Set(),
    moving: false,
    avatarWaypoint: null, // { x, y } layout-unit override during path animation
    droppedPickups: [],
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
    return [
      ...(building.value.pickups ?? [])
      .filter((p) => p.room === roomId && !indoor.pickupsTaken.has(p.id))
      .filter((p) => !p.stand || p.stand === indoor.currentStand)
      .map((pickup) => ({
        ...pickup,
        label: pickup.label ?? catalog[pickup.item]?.label ?? pickup.item,
      })),
      ...droppedPickupsAtCurrentLocation(catalog),
    ];
  });

  function discoverIndoorRoom(roomId) {
    indoor.discovered = new Set([...indoor.discovered, roomId]);
    const next = new Set(indoor.revealed);
    applyRevealDoorsForRoom(building.value, next, roomId);
    indoor.revealed = next;
  }

  function tryPickup(pickupId) {
    const dropped = droppedPickupRecord(pickupId);
    if (dropped && character) {
      transferHolding(character.holdings, character.definitions, {
        type: dropped.type,
        id: dropped.id,
        quantity: 1,
        toHolder: characterHolderId(character.holdings),
      });
      return;
    }
    if (dropped && !character) {
      indoor.inventory.add(dropped.item);
      indoor.droppedPickups = indoor.droppedPickups.filter((pickup) => pickup.id !== pickupId);
      return;
    }

    const pickup = (building.value.pickups ?? []).find((p) => p.id === pickupId);
    if (!pickup || indoor.pickupsTaken.has(pickupId)) return;
    if (pickup.room !== indoor.currentRoom) return;
    if (pickup.stand && pickup.stand !== indoor.currentStand) return;
    if (character) {
      // Prefer transferring a holdings container already at this stand (stocked boxes).
      const locationInstance = findContainerInstanceAtLocation(character, pickup.item, {
        room: pickup.room,
        stand: pickup.stand ?? null,
      });
      if (locationInstance) {
        try {
          transferHolding(character.holdings, character.definitions, {
            type: "instance",
            id: locationInstance,
            quantity: 1,
            toHolder: characterHolderId(character.holdings),
          });
          markCharacterChanged(character);
        } catch {
          return;
        }
      } else {
        const result = applyEffectsAtomically(
          [{ op: "item.add", id: pickup.item, quantity: 1 }],
          { character, flags: indoor.flags },
        );
        if (!result.ok) return;
      }
    } else {
      indoor.inventory.add(pickup.item);
    }
    indoor.pickupsTaken = new Set([...indoor.pickupsTaken, pickupId]);
  }

  function findContainerInstanceAtLocation(characterState, itemId, { room, stand = null } = {}) {
    const holders = characterState?.holdings?.holders ?? {};
    const holderId = Object.values(holders).find((holder) => {
      if (holder.kind !== "fixed") return false;
      const location = holder.location ?? {};
      if (location.room !== room) return false;
      return stand ? location.stand === stand : !location.stand;
    })?.id;
    if (!holderId) return null;
    const found = Object.entries(characterState.holdings.instances ?? {}).find(
      ([, instance]) => instance.item === itemId && instance.holder === holderId,
    );
    return found?.[0] ?? null;
  }

  function dropItem(itemId) {
    if (!itemId) return;
    if (character) {
      const record = carriedRecord(itemId);
      if (!record) return;
      const holderId = ensureWorldHolder(character.holdings, currentIndoorLocation());
      transferHolding(character.holdings, character.definitions, {
        type: record.type,
        id: record.id,
        quantity: 1,
        toHolder: holderId,
      });
      return;
    }
    if (!indoor.inventory?.has(itemId)) return;
    removeItem(indoor.inventory, itemId);
    const id = `dropped:${itemId}:${Date.now()}`;
    indoor.droppedPickups = [
      ...indoor.droppedPickups,
      {
        id,
        item: itemId,
        label: itemId,
        ...currentIndoorLocation(),
      },
    ];
  }

  function currentIndoorLocation() {
    return {
      place: "indoors",
      room: indoor.currentRoom ?? null,
      exteriorNode: indoor.exteriorNode ?? null,
      stand: indoor.currentStand ?? null,
    };
  }

  function sameIndoorLocation(a = {}, b = {}) {
    return (
      (a.place ?? "indoors") === (b.place ?? "indoors") &&
      (a.room ?? null) === (b.room ?? null) &&
      (a.exteriorNode ?? null) === (b.exteriorNode ?? null) &&
      (a.stand ?? null) === (b.stand ?? null)
    );
  }

  function nearbyWorldHolderIds() {
    const here = currentIndoorLocation();
    return Object.values(character?.holdings?.holders ?? {})
      .filter((holder) => holder.kind === "world")
      .filter((holder) => sameIndoorLocation(holder.location, here))
      .map((holder) => holder.id);
  }

  function droppedPickupsAtCurrentLocation(catalog) {
    if (!character) {
      const here = currentIndoorLocation();
      return (indoor.droppedPickups ?? [])
        .filter((pickup) => sameIndoorLocation(pickup, here))
        .map((pickup) => ({
          ...pickup,
          label: pickup.label ?? catalog[pickup.item]?.label ?? pickup.item,
        }));
    }
    return holdingRecords(
      character.holdings,
      character.definitions,
      nearbyWorldHolderIds(),
    ).map((record) => ({
      id: droppedPickupId(record),
      item: record.item,
      label: record.definition?.label ?? catalog[record.item]?.label ?? record.item,
      dynamic: true,
    }));
  }

  function droppedPickupRecord(pickupId) {
    if (!character) {
      const here = currentIndoorLocation();
      return (indoor.droppedPickups ?? [])
        .filter((pickup) => sameIndoorLocation(pickup, here))
        .find((pickup) => pickup.id === pickupId) ?? null;
    }
    if (!String(pickupId).startsWith("holding:")) return null;
    const [, type, ...idParts] = String(pickupId).split(":");
    const id = idParts.join(":");
    return holdingRecords(
      character.holdings,
      character.definitions,
      nearbyWorldHolderIds(),
    ).find((record) => record.type === type && record.id === id);
  }

  function droppedPickupId(record) {
    return `holding:${record.type}:${record.id}`;
  }

  function carriedRecord(itemId) {
    return holdingRecords(
      character.holdings,
      character.definitions,
      [characterHolderId(character.holdings)],
    ).find((record) => record.item === itemId);
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
    indoor.facility.lightSwitches = {};
    if (!flagsAreShared) {
      indoor.flags = createFlags();
    }
    indoor.completedActions = new Set();
    indoor.avatarWaypoint = null;
    indoor.moving = false;
    indoor.droppedPickups = [];
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
    dropItem,
    resetIndoor,
    flagsAreShared,
    inventoryIsShared,
  };
}
