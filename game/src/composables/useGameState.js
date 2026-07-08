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

export const SAVE_VERSION = 12;
export const DEFAULT_PLAY_MODE = "story";
export const STORY_ARC_ID = "part-i-opener";
const PLAY_MODES = new Set(["story", "open-world"]);

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
    milestones: {},
    facilities: {
      hydro: createHydroState(),
    },
    playMode: null,
    story: createStoryState(),
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
    milestones: clonePlain(gameState.milestones ?? {}),
    playMode: normalizePlayMode(gameState.playMode),
    story: captureStoryState(gameState),
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
  gameState.milestones = plainObject(snapshot.milestones);
  gameState.playMode = normalizePlayMode(snapshot.playMode);
  gameState.story = normalizeStoryState(snapshot.story, gameState.playMode);
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
  gameState.milestones = {};
  gameState.playMode = null;
  gameState.story = createStoryState();
  gameState.facilities = {
    hydro: createHydroState(),
  };

  outdoor.resetPlayer();
  indoor.resetIndoor();
  place.value = "outdoors";
}

export function setPlayMode(gameState, mode, {
  activeArcId = null,
  activeBeatId = null,
} = {}) {
  gameState.playMode = normalizePlayMode(mode);
  gameState.story = gameState.playMode === "story"
    ? createStoryState({ activeArcId: activeArcId ?? STORY_ARC_ID, activeBeatId })
    : null;
}

export function normalizePlayMode(mode) {
  return PLAY_MODES.has(mode) ? mode : DEFAULT_PLAY_MODE;
}

export function createStoryState({
  activeArcId = STORY_ARC_ID,
  activeBeatId = null,
  completedBeatIds = [],
  enteredBeatIds = [],
  seenSceneIds = [],
} = {}) {
  return {
    activeArcId,
    activeBeatId,
    completedBeatIds: [...completedBeatIds],
    enteredBeatIds: [...enteredBeatIds],
    seenSceneIds: [...seenSceneIds],
  };
}

function normalizeStoryState(value, playMode) {
  if (playMode !== "story") return null;
  return createStoryState({
    activeArcId: value?.activeArcId || STORY_ARC_ID,
    activeBeatId: value?.activeBeatId || null,
    completedBeatIds: normalizeIdList(value?.completedBeatIds),
    enteredBeatIds: normalizeIdList(value?.enteredBeatIds),
    seenSceneIds: normalizeIdList(value?.seenSceneIds),
  });
}

function captureStoryState(gameState) {
  const mode = normalizePlayMode(gameState.playMode);
  if (mode !== "story") return null;
  const story = normalizeStoryState(gameState.story, mode);
  return createStoryState({
    activeArcId: story?.activeArcId ?? STORY_ARC_ID,
    activeBeatId: story?.activeBeatId ?? null,
    completedBeatIds: story?.completedBeatIds,
    enteredBeatIds: story?.enteredBeatIds,
    seenSceneIds: story?.seenSceneIds?.length ? story.seenSceneIds : [...(gameState.storySeen ?? [])],
  });
}

function normalizeIdList(value) {
  return Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : [];
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? clonePlain(value)
    : {};
}
