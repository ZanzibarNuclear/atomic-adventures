import { reactive, toRaw } from "vue";
import {
  buildBuilding,
  defaultRoomStandId,
  roomStandById,
} from "../lib/maps/composables/useGrid.js";
import { buildInitialDoorState } from "../lib/maps/composables/useDoors.js";
import { createFlags } from "../lib/maps/composables/useFlags.js";
import { normalizeMapMode } from "../lib/maps/composables/useHexMapViewport.js";
import {
  applyCharacterState,
  captureCharacterState,
  createCharacterState,
  resetCharacterState,
} from "./useCharacterState.js";
import { createGameClock } from "../lib/character/gameTime.js";
import {
  createHydroState,
  normalizeHydroState,
} from "../lib/simulations/hydro/index.js";

export const SAVE_VERSION = 10;
export const DEFAULT_PLAY_MODE = "storyline";
export const STORYLINE_SCENARIO_ID = "part-i-opener";
const PLAY_MODES = new Set(["storyline", "open-world"]);

/** Plain JSON-safe clone — structuredClone fails on Vue reactive proxies. */
function clonePlain(value) {
  return JSON.parse(JSON.stringify(toRaw(value)));
}

export function createGameState({ mapData, buildingData, characterData = {} }) {
  const startHex = mapData.start ?? mapData.journey?.[0];
  const building = buildBuilding(buildingData);

  return reactive({
    flags: createFlags(),
    storySeen: new Set(),
    endCardDismissed: false,
    clock: createGameClock(),
    character: createCharacterState(characterData, buildingData.holders ?? []),
    lessons: {},
    facilities: {
      hydro: createHydroState(),
    },
    playMode: null,
    storyline: createStorylineState(),
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
    clock: clonePlain(gameState.clock),
    character: captureCharacterState(gameState.character),
    lessons: clonePlain(gameState.lessons ?? {}),
    playMode: normalizePlayMode(gameState.playMode),
    storyline: captureStorylineState(gameState),
    facilities: {
      hydro: clonePlain(gameState.facilities?.hydro ?? createHydroState()),
    },
    outdoor: {
      currentId: outdoor.state.currentId,
      previousId: outdoor.state.previousId ?? null,
      mapTransition: outdoor.state.mapTransition ?? null,
      transitionDirection: outdoor.state.transitionDirection ?? null,
      discovered: [...outdoor.state.discovered],
      stand: { ...outdoor.state.stand },
      lastBlocked: outdoor.state.lastBlocked,
      atBarrier: outdoor.state.atBarrier,
      discoveredOpenings: [...outdoor.state.discoveredOpenings],
      passageStates: clonePlain(outdoor.state.passageStates ?? {}),
      mode: outdoor.mode,
    },
    indoor: {
      currentRoom: i.currentRoom,
      currentStand: i.currentStand,
      exteriorNode: i.currentRoom ? null : i.exteriorNode,
      discovered: [...i.discovered],
      revealed: [...i.revealed],
      level: i.level,
      viewLevel: i.viewLevel,
      doorState: clonePlain(i.doorState),
      pickupsTaken: [...i.pickupsTaken],
      facility: clonePlain(i.facility),
      completedActions: [...i.completedActions],
      // Resume from the last committed authored location, not an animation-only
      // point between exterior nodes.
      avatarWaypoint: null,
    },
  };
}

function applyOutdoorSnapshot(o, outdoor) {
  outdoor.state.currentId = o.currentId ?? outdoor.START;
  outdoor.state.previousId = o.previousId ?? null;
  outdoor.state.mapTransition = o.mapTransition ?? null;
  outdoor.state.transitionDirection = o.transitionDirection ?? null;
  outdoor.state.discovered = [...(o.discovered ?? [outdoor.state.currentId])];

  if (o.stand) {
    outdoor.state.stand = { ...o.stand };
  } else {
    outdoor.state.stand = outdoor.defaultStandForHex(outdoor.state.currentId);
  }

  outdoor.state.lastBlocked = o.lastBlocked ?? null;
  outdoor.state.atBarrier = o.atBarrier ?? null;
  outdoor.state.discoveredOpenings = [...(o.discoveredOpenings ?? [])];
  outdoor.state.passageStates = clonePlain(o.passageStates ?? {});
  if (o.mode) outdoor.mode = normalizeMapMode(o.mode);
}

export function applySnapshot(snapshot, { gameState, place, outdoor, indoor }) {
  if (!snapshot || snapshot.version > SAVE_VERSION) return false;

  gameState.flags = createFlags(snapshot.flags ?? []);
  indoor.indoor.flags = gameState.flags;
  gameState.storySeen = new Set(snapshot.storySeen ?? []);
  gameState.endCardDismissed = snapshot.endCardDismissed ?? false;
  gameState.clock = createGameClock(snapshot.clock);
  if (snapshot.character) applyCharacterState(gameState.character, snapshot.character);
  gameState.lessons = plainObject(snapshot.lessons);
  gameState.playMode = normalizePlayMode(snapshot.playMode);
  gameState.storyline = normalizeStorylineState(snapshot.storyline, gameState.playMode);
  gameState.facilities = {
    hydro: normalizeHydroState(snapshot.facilities?.hydro ?? {
      ...createHydroState(),
      online: snapshot.indoor?.facility?.hydroOnline ?? false,
      startupComplete: snapshot.indoor?.facility?.hydroOnline ?? false,
    }),
  };

  applyOutdoorSnapshot(snapshot.outdoor ?? {}, outdoor);

  const building = indoor.building;
  const i = snapshot.indoor ?? {};
  const d = indoor.indoor;
  d.currentRoom = i.currentRoom && building.roomById[i.currentRoom] ? i.currentRoom : null;
  d.currentStand = d.currentRoom && roomStandById(building, d.currentRoom, i.currentStand)
    ? i.currentStand
    : d.currentRoom
      ? defaultRoomStandId(building.roomById[d.currentRoom])
      : null;
  d.exteriorNode = d.currentRoom
    ? null
    : i.exteriorNode && building.exterior?.nodeById?.[i.exteriorNode]
      ? i.exteriorNode
      : building.exterior?.entry ?? null;
  d.discovered = new Set(i.discovered ?? []);
  d.revealed = new Set(i.revealed ?? []);
  d.level = i.level ?? building.exterior?.level ?? "first";
  d.viewLevel = i.viewLevel ?? d.level;
  d.doorState = i.doorState ?? buildInitialDoorState(building.areaId, building);
  d.pickupsTaken = new Set(i.pickupsTaken ?? []);
  d.facility = {
    hydroOnline: gameState.facilities.hydro.online || (i.facility?.hydroOnline ?? false),
    manualMode: { ...(i.facility?.manualMode ?? {}) },
  };
  d.completedActions = new Set(i.completedActions ?? []);
  d.avatarWaypoint = null;
  d.moving = false;

  place.value = snapshot.place === "indoors" ? "indoors" : "outdoors";
  return true;
}

export function resetGameState({ gameState, place, outdoor, indoor }) {
  gameState.flags = createFlags();
  indoor.indoor.flags = gameState.flags;
  gameState.storySeen = new Set();
  gameState.endCardDismissed = false;
  gameState.clock = createGameClock();
  resetCharacterState(gameState.character);
  gameState.lessons = {};
  gameState.playMode = null;
  gameState.storyline = createStorylineState();
  gameState.facilities = {
    hydro: createHydroState(),
  };

  outdoor.resetPlayer();
  indoor.resetIndoor();
  place.value = "outdoors";
}

export function setPlayMode(gameState, mode, {
  scenarioId = STORYLINE_SCENARIO_ID,
  stepId = null,
  objective = null,
} = {}) {
  gameState.playMode = normalizePlayMode(mode);
  gameState.storyline = gameState.playMode === "storyline"
    ? createStorylineState({ scenarioId, stepId, objective })
    : null;
}

export function normalizePlayMode(mode) {
  return PLAY_MODES.has(mode) ? mode : DEFAULT_PLAY_MODE;
}

export function createStorylineState({
  scenarioId = STORYLINE_SCENARIO_ID,
  stepId = null,
  completedStepIds = [],
  enteredStepIds = [],
  objective = null,
} = {}) {
  return {
    scenarioId,
    stepId,
    completedStepIds: [...completedStepIds],
    enteredStepIds: [...enteredStepIds],
    objective,
  };
}

function normalizeStorylineState(value, playMode) {
  if (playMode !== "storyline") return null;
  const completed = Array.isArray(value?.completedStepIds)
    ? value.completedStepIds.map(String).filter(Boolean)
    : [];
  return createStorylineState({
    scenarioId: value?.scenarioId || STORYLINE_SCENARIO_ID,
    stepId: value?.stepId || null,
    completedStepIds: completed,
    enteredStepIds: Array.isArray(value?.enteredStepIds)
      ? value.enteredStepIds.map(String).filter(Boolean)
      : [],
    objective: value?.objective || null,
  });
}

function captureStorylineState(gameState) {
  const mode = normalizePlayMode(gameState.playMode);
  if (mode !== "storyline") return null;
  return normalizeStorylineState(gameState.storyline, mode);
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? clonePlain(value)
    : {};
}
