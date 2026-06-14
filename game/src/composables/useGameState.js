import { reactive } from "vue";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState } from "../lib/maps/composables/useDoors.js";
import { createFlags } from "../lib/maps/composables/useFlags.js";
import { createInventory } from "../lib/maps/composables/useInventory.js";

export const SAVE_VERSION = 1;

export function createGameState({ mapData, buildingData }) {
  const startHex = mapData.start ?? mapData.journey?.[0];
  const building = buildBuilding(buildingData);

  return reactive({
    flags: createFlags(),
    storySeen: new Set(),
    endCardDismissed: false,
    _startHex: startHex,
    _buildingData: buildingData,
  });
}

export function captureSnapshot({ gameState, place, outdoor, indoor }) {
  const i = indoor.indoor;
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    place: place.value,
    flags: [...gameState.flags],
    storySeen: [...gameState.storySeen],
    endCardDismissed: gameState.endCardDismissed,
    outdoor: {
      currentId: outdoor.state.currentId,
      discovered: [...outdoor.state.discovered],
      barrierStand: outdoor.state.barrierStand
        ? { ...outdoor.state.barrierStand }
        : null,
      lastBlocked: outdoor.state.lastBlocked,
      mode: outdoor.mode,
    },
    indoor: {
      currentRoom: i.currentRoom,
      exteriorNode: i.exteriorNode,
      discovered: [...i.discovered],
      revealed: [...i.revealed],
      level: i.level,
      viewLevel: i.viewLevel,
      doorState: structuredClone(i.doorState),
      inventory: [...i.inventory],
      pickupsTaken: [...i.pickupsTaken],
      facility: structuredClone(i.facility),
      completedActions: [...i.completedActions],
      avatarWaypoint: i.avatarWaypoint ? { ...i.avatarWaypoint } : null,
    },
  };
}

export function applySnapshot(snapshot, { gameState, place, outdoor, indoor }) {
  if (!snapshot || snapshot.version !== SAVE_VERSION) return false;

  gameState.flags = createFlags(snapshot.flags ?? []);
  indoor.indoor.flags = gameState.flags;
  gameState.storySeen = new Set(snapshot.storySeen ?? []);
  gameState.endCardDismissed = snapshot.endCardDismissed ?? false;

  const o = snapshot.outdoor ?? {};
  outdoor.state.currentId = o.currentId ?? gameState._startHex;
  outdoor.state.discovered = [...(o.discovered ?? [outdoor.state.currentId])];
  outdoor.state.barrierStand = o.barrierStand ? { ...o.barrierStand } : null;
  outdoor.state.lastBlocked = o.lastBlocked ?? null;
  if (o.mode) outdoor.mode = o.mode;

  const building = indoor.building;
  const i = snapshot.indoor ?? {};
  const d = indoor.indoor;
  d.currentRoom = i.currentRoom ?? null;
  d.exteriorNode = i.exteriorNode ?? building.exterior?.entry ?? null;
  d.discovered = new Set(i.discovered ?? []);
  d.revealed = new Set(i.revealed ?? []);
  d.level = i.level ?? building.exterior?.level ?? "first";
  d.viewLevel = i.viewLevel ?? d.level;
  d.doorState = i.doorState ?? buildInitialDoorState(building.areaId, building);
  d.inventory = createInventory(i.inventory ?? []);
  d.pickupsTaken = new Set(i.pickupsTaken ?? []);
  d.facility = {
    hydroOnline: i.facility?.hydroOnline ?? false,
    manualMode: { ...(i.facility?.manualMode ?? {}) },
  };
  d.completedActions = new Set(i.completedActions ?? []);
  d.avatarWaypoint = i.avatarWaypoint ? { ...i.avatarWaypoint } : null;
  d.moving = false;

  place.value = snapshot.place === "indoors" ? "indoors" : "outdoors";
  return true;
}

export function resetGameState({ gameState, place, outdoor, indoor }) {
  gameState.flags = createFlags();
  indoor.indoor.flags = gameState.flags;
  gameState.storySeen = new Set();
  gameState.endCardDismissed = false;

  outdoor.resetPlayer();
  indoor.resetIndoor();
  place.value = "outdoors";
}
