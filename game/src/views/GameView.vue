<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { useIndoorBuilding } from "../lib/maps/composables/useIndoorBuilding.js";
import { captureSnapshot, createGameState, resetGameState, setPlayMode } from "../composables/useGameState.js";
import { useSaveGame } from "../composables/useSaveGame.js";
import { pushPlayMessage } from "../composables/usePlayMessages.js";
import { useStoryArc } from "../composables/useStoryArc.js";
import { useOpenWorldStory } from "../composables/useOpenWorldStory.js";
import { normalizeStoryArcContent } from "../composables/storyArcModel.js";
import { useStoryContent } from "../composables/useStoryContent.js";
import { useWorldContent } from "../composables/useWorldContent.js";
import { useBuildingContent } from "../composables/useBuildingContent.js";
import { useGameView } from "../composables/useGameView.js";
import { useCharacterContent } from "../composables/useCharacterContent.js";
import { useLearningContent } from "../composables/useLearningContent.js";
import { useStoryArcContent } from "../composables/useStoryArcContent.js";
import {
  isActionAllowed,
  isStageViewAllowed,
} from "../composables/storyActionAvailability.js";
import {
  markCharacterChanged,
  syncCharacterDefinitions,
  syncCharacterHolderDefinitions,
} from "../composables/useCharacterState.js";
import { applyOutdoorWorldUpdate } from "../composables/worldRuntime.js";
import { availableItemActions, performItemAction } from "../lib/character/itemActions.js";
import { performWellbeingAction } from "../lib/character/wellbeingActions.js";
import { performQuickConsume } from "../lib/character/quickConsume.js";
import {
  accessibleHolderIds,
  characterHolderId,
  ensureWorldHolder,
  holdingRecords,
  transferHolding,
} from "../lib/character/holdings.js";
import { containerInstanceLabel } from "../lib/character/containerLabels.js";
import { vesselDisplayLabel } from "../lib/character/vessels.js";
import AppHeader from "../components/AppHeader.vue";
import SaveGamesDialog from "../components/SaveGamesDialog.vue";
import TitleScreen from "../components/TitleScreen.vue";
import CharacterView from "../components/game-views/CharacterView.vue";
import CharacterStatsStageView from "../components/game-views/CharacterStatsStageView.vue";
import DeveloperSettingsDialog from "../components/dev/DeveloperSettingsDialog.vue";
import HoloReaderView from "../components/game-views/HoloReaderView.vue";
import HydroConsoleView from "../components/game-views/HydroConsoleView.vue";
import InstructionCardView from "../components/game-views/InstructionCardView.vue";
import ContainerContentsDialog from "../components/game-views/ContainerContentsDialog.vue";
import ContainerGroupDialog from "../components/game-views/ContainerGroupDialog.vue";
import InventoryDialog from "../components/game-views/InventoryDialog.vue";
import InventoryStageView from "../components/game-views/InventoryStageView.vue";
import StoryOverlay from "../components/story/StoryOverlay.vue";
import OutdoorScene from "../lib/maps/views/OutdoorScene.vue";
import IndoorScene from "../lib/maps/views/IndoorScene.vue";
import {
  characterWellbeingOverview,
  visibleCharacterStats,
} from "../lib/character/panel.js";
import {
  hasRecoveredFromPreEmpty,
  listPreEmptyCrisisVitals,
  preEmptyCrisisMessage,
  preEmptyCrisisTitle,
} from "../lib/character/wellbeingCrisis.js";
import {
  resolveIndoorLocationMedia,
  resolveOutdoorLocationMedia,
} from "../lib/maps/locationMedia.js";
import { completeLesson } from "../lib/learning/completion.js";
import {
  HOLO_READER_BROWSER_ACTION_ID,
  availableHoloReaderLessons,
  buildHoloReaderActions,
} from "../lib/learning/holoReaderActions.js";
import {
  isStationPowerOverriddenOn,
  setStationPowerOverride,
} from "../lib/dev/developerOverrides.js";

const place = ref("outdoors");
const builderView = ref(false);
const movementAuditVisible = ref(false);
const developerSettingsVisible = ref(false);
/** One-shot info modal when a vital enters the band just above empty. */
const vitalCrisisAlert = ref(null); // { id, title, message }
/** Vital ids already warned this crisis episode (cleared on recovery). */
const vitalCrisisAlertedIds = ref(new Set());
const inventoryDialogVisible = ref(false);
/** Focused look-in for a world/carried container instance id (without full inventory). */
const lookInContainerInstanceId = ref(null);
const lookInSelectedHoldingId = ref(null);
const itemActionFeedback = ref("");
const wellbeingActionFeedback = ref("");
const containerGroupInspect = ref(null);
const locationMediaMode = ref("map");
const locationMediaIndex = ref(0);
const locationMediaKey = ref(null);
const WELLBEING_STAT_IDS = new Set(["health", "satiety", "hydration", "energy", "composure"]);
const {
  activeView,
  isMapView,
  isCharacterView,
  openView,
  openCharacter,
  openInventory,
  openCharacterStats,
  returnToMap,
} = useGameView();
const { storyData, error: contentError, refresh: refreshContent } = useStoryContent();
const {
  worldData,
  error: worldContentError,
  refresh: refreshWorld,
} = useWorldContent();
const {
  buildingData,
  error: buildingContentError,
  refresh: refreshBuilding,
} = useBuildingContent();
const {
  characterData,
  error: characterContentError,
  refresh: refreshCharacter,
} = useCharacterContent();
const {
  lessons,
  error: learningContentError,
  refresh: refreshLearning,
} = useLearningContent();
const {
  storyArcDocument,
  error: storyArcContentError,
  refresh: refreshStoryArcs,
} = useStoryArcContent();
const mapData = JSON.parse(JSON.stringify(worldData.value));
const initialBuildingData = JSON.parse(JSON.stringify(buildingData.value));

const gameState = createGameState({
  mapData,
  buildingData: initialBuildingData,
  characterData: characterData.value,
});
const outdoor = useOutdoorWorld(mapData, gameState);
const ctx = { place, builderView, gameState };
const indoor = useIndoorBuilding(initialBuildingData, outdoor, ctx);
const save = useSaveGame();
const {
  activeSlot,
  lastSavedAt,
  loadError,
  slots: saveSlots,
  hasSave,
  firstOpenSlot,
  mostRecentlySavedSlot,
  save: saveGame,
  load,
  clearSave,
  setActiveSlot,
} = save;

/** Fingerprint of last clean (saved / loaded / reset) state for dirty checks. */
const cleanFingerprint = ref(null);
/**
 * Pending action after a save-before-switch modal:
 * { type: 'play'|'restart'|'new-open', gameId?, mode? }
 */
const pendingSaveAction = ref(null);
/** When all games are full, pick which to overwrite for New Game from the menu. */
const pickGameDialog = ref(null); // { mode: 'story'|'open-world'|null } null mode = menu New Game
/** Restart confirm: { gameId } before wiping a saved game. */
const restartDialog = ref(null);

const openStageViewForStory = (view) => openStageView(view, { force: true });
const storyArcData = computed(() => normalizeStoryArcContent(storyArcDocument.value, {
  storyData: storyData.value,
}));
const {
  activeArc,
  activeBeat,
  displayScene,
  displayBeat,
  activeChoices,
  pendingCompletion,
  storyActions,
  applyStoryAction,
  dismissCompletion,
  storyError,
  tick: tickStoryArc,
} = useStoryArc(storyArcData, {
  gameState,
  place,
  outdoor,
  indoor,
  openStageView: openStageViewForStory,
});
const openWorldStory = useOpenWorldStory(storyData, {
  gameState,
  place,
  outdoor,
  indoor,
  openStageView: openStageViewForStory,
});
const narrativeBeat = computed(() => {
  if (gameState.playMode === "open-world") return openWorldStory.activeScene.value;
  const scene = displayScene.value;
  if (!scene) return null;
  const seen = gameState.story?.seenSceneIds?.includes(scene.id) ?? false;
  return {
    id: scene.id,
    eyebrow: scene.eyebrow,
    heading: scene.heading,
    text: seen && scene.revisitProse ? scene.revisitProse : scene.prose,
    revisit: seen && Boolean(scene.revisitProse),
    choices: activeChoices.value,
  };
});
const pendingBeat = computed(() => activeBeat.value
  ? { ...activeBeat.value, choices: activeChoices.value }
  : gameState.playMode === "open-world"
    ? openWorldStory.activeBeat.value
    : null);
const actionBeat = computed(() => displayBeat.value ?? activeBeat.value);
const storyActionAvailability = computed(() => ({
  mode: gameState.playMode === "story" ? "story" : "open-world",
  beatId: actionBeat.value?.id ?? null,
  allowed: actionBeat.value?.allowed ?? null,
  unrestricted: gameState.playMode !== "story" || !actionBeat.value,
}));
const wellbeingItemActionIds = computed(() => itemActionIdsForWellbeing(gameState.character));
const locationMediaContext = computed(() => {
  const facility = indoor.indoor?.facility ?? indoor.facility;
  const stationPowerOnline = Boolean(
    indoor.powerOn
      || facility?.hydroOnline
      || gameState.flags?.has?.("hub.hydro_online"),
  );
  const roomId = indoor.indoor?.currentRoom ?? null;
  const roomLightsOn = Boolean(
    stationPowerOnline && roomId && facility?.lightSwitches?.[roomId],
  );
  return {
    flags: gameState.flags,
    stationPowerOnline,
    roomLightsOn,
    passageStates: outdoor.state?.passageStates ?? outdoor.passageMarkerStates ?? {},
  };
});
const currentLocationMedia = computed(() =>
  place.value === "indoors"
    ? resolveIndoorLocationMedia(indoor, locationMediaContext.value)
    : resolveOutdoorLocationMedia(outdoor, locationMediaContext.value),
);

/** Story action ids use choice.id when present, else the choice index (ambient scenes often omit ids). */
function storyActionIdForChoice(choice, index) {
  if (choice?.id != null && choice.id !== "") return `story:${choice.id}`;
  return `story:${index}`;
}

function applyChoice(index = 0) {
  if (gameState.playMode === "open-world") {
    openWorldStory.applyChoice(index);
    return;
  }
  const i = Number(index);
  const choice = activeChoices.value?.[i];
  if (!choice) return;
  applyStoryAction(storyActionIdForChoice(choice, i));
}

function travelToHex(hexId) {
  if (gameState.playMode === "open-world") {
    if (!outdoor.canReachHex(hexId)) return;
    outdoor.moveTo(hexId);
    return;
  }
  const index = activeChoices.value?.findIndex((candidate) => candidate.go_hex === hexId) ?? -1;
  if (index >= 0) {
    applyChoice(index);
    return;
  }
  if (!outdoor.canReachHex(hexId)) return;
  outdoor.moveTo(hexId);
}

function enterBuilding() {
  if (gameState.playMode === "open-world") {
    indoor.enterBuilding();
    return;
  }
  const index = activeChoices.value?.findIndex((candidate) => candidate.enter) ?? -1;
  if (index >= 0) {
    applyChoice(index);
    return;
  }
  indoor.enterBuilding();
}

function travelToRoom(roomId) {
  if (gameState.playMode === "open-world") {
    indoor.moveToRoom(roomId);
    return;
  }
  const index = activeChoices.value?.findIndex((candidate) => candidate.go_room === roomId) ?? -1;
  if (index >= 0) {
    applyChoice(index);
    return;
  }
  indoor.moveToRoom(roomId);
}

function refreshStoryMoment() {
  tickStoryArc();
  openWorldStory.refreshScene();
}

const saveCtx = computed(() => ({ gameState, place, outdoor, indoor }));
const nearbyHolderIds = computed(() => {
  const ids = [];
  for (const holder of Object.values(gameState.character.holdings.holders ?? {})) {
    if (holder.kind === "vehicle" || holder.kind === "fixed") {
      const location = holder.location ?? {};
      if (
        place.value === "indoors" &&
        location.room &&
        location.room === indoor.indoor.currentRoom &&
        (!location.stand || location.stand === indoor.indoor.currentStand)
      ) {
        ids.push(holder.id);
      }
      if (
        place.value === "indoors" &&
        location.exteriorNode &&
        location.exteriorNode === indoor.indoor.exteriorNode &&
        (!location.stand || location.stand === indoor.indoor.currentStand)
      ) {
        ids.push(holder.id);
      }
      if (place.value === "outdoors" && location.hex && location.hex === outdoor.state.currentId) {
        ids.push(holder.id);
      }
    }
  }
  return ids;
});
const stageSelectedHoldingId = ref(null);
function inventoryHolderViews(ids) {
  return ids.map((id) => {
    const holder = gameState.character.holdings.holders[id] ?? { id, label: id, kind: "holder" };
    return {
      ...holder,
      shortLabel: holder.shortLabel ?? null,
      records: holdingRecords(
        gameState.character.holdings,
        gameState.character.definitions,
        [id],
      ).map((record) => decorateHoldingRecord(record)),
    };
  });
}

function decorateHoldingRecord(record) {
  const definition = record.definition;
  const contentId = record.contents?.item;
  const contentDef = contentId
    ? (gameState.character.definitions?.items ?? []).find((item) => item.id === contentId)
    : null;
  let label = definition?.label ?? record.item;
  if (definition?.vessel && record.type === "instance") {
    label = vesselDisplayLabel(record, definition, contentDef);
  }
  const actions = availableItemActions(gameState.character, record.item, {
    recordId: record.type === "instance" ? record.id : null,
  });
  return {
    ...record,
    label,
    shortLabel: definition?.shortLabel ?? null,
    description: definition?.description ?? "",
    kind: definition?.kind ?? "item",
    icon: definition?.icon ?? null,
    actions,
  };
}

const inventoryHolders = computed(() => {
  const ids = [...accessibleHolderIds(
    gameState.character.holdings,
    "nearby",
    [...nearbyHolderIds.value, currentWorldHolderId()],
  )];
  return inventoryHolderViews(ids);
});
const outdoorGroundHoldings = computed(() => {
  if (place.value !== "outdoors") return [];
  return holdingRecords(
    gameState.character.holdings,
    gameState.character.definitions,
    [currentWorldHolderId()],
  )
    .filter((record) => record.definition?.portable !== false)
    .map((record) => ({
      ...record,
      label: record.definition?.label ?? record.item,
    }));
});
const playerInventoryHolders = computed(() =>
  inventoryHolderViews([...accessibleHolderIds(gameState.character.holdings, "carried")]),
);
const transferTargets = computed(() => inventoryHolders.value
  .filter((holder) => holder.kind !== "container")
  .map((holder) => ({
    id: holder.id,
    label: holder.label ?? holder.id,
    shortLabel: holder.shortLabel ?? null,
    kind: holder.kind,
    accepts: holder.accepts ?? null,
  })));
const stageSelectedHolding = computed(() =>
  inventoryHolders.value.flatMap((holder) =>
    holder.records.map((record) => ({ ...record, holder })))
    .find((record) => `${record.type}:${record.id}` === stageSelectedHoldingId.value) ?? null,
);
const playerInventoryTransferTargets = computed(() =>
  playerInventoryHolders.value
    .filter((holder) => holder.kind !== "container")
    .map((holder) => ({
      id: holder.id,
      label: holder.label ?? holder.id,
      kind: holder.kind,
    })),
);
const playerSelectedHolding = computed(() =>
  playerInventoryHolders.value.flatMap((holder) =>
    holder.records.map((record) => ({ ...record, holder })))
    .find((record) => `${record.type}:${record.id}` === stageSelectedHoldingId.value) ?? null,
);
const characterStats = computed(() => visibleCharacterStats(gameState.character));
const characterDisplayName = computed(
  () => gameState.character?.definitions?.profile?.name ?? "Zanzibar Nuhero",
);
const characterPortraitSrc = computed(() =>
  publicAssetPath(gameState.character?.definitions?.profile?.portrait),
);
const wellbeingOverview = computed(() => characterWellbeingOverview(gameState.character));
const mustRest = computed(() => Number(gameState.character.stats?.energy ?? 100) <= 0);
const wellbeingAvailableActions = computed(() => ({
  ...(storyActionAvailability.value ?? {}),
  allowed: mergeAllowedItemActions(
    storyActionAvailability.value?.allowed,
    wellbeingItemActionIds.value,
  ),
  mustRest: mustRest.value,
}));
const catastrophicVitals = computed(() => {
  const overview = wellbeingOverview.value;
  const fatalIds = new Set(["health", "satiety", "hydration"]);
  const candidates = [
    overview?.health,
    ...(overview?.vitals ?? []),
  ].filter((vital) => vital && fatalIds.has(vital.id));
  // Dedupe by id (health may appear only on overview.health).
  const byId = new Map(candidates.map((vital) => [vital.id, vital]));
  return [...byId.values()].filter((vital) =>
    Number(vital.value) <= Number(vital.min ?? 0),
  );
});
const gameFailed = computed(() => catastrophicVitals.value.length > 0);

function pruneRecoveredCrisisAlerts(overview) {
  const next = new Set(vitalCrisisAlertedIds.value);
  for (const vital of [...(overview?.vitals ?? []), overview?.health].filter(Boolean)) {
    if (hasRecoveredFromPreEmpty(vital)) next.delete(vital.id);
  }
  vitalCrisisAlertedIds.value = next;
}

/** Show the next unacknowledged pre-empty crisis (one modal at a time). */
function showNextVitalCrisisIfNeeded() {
  if (vitalCrisisAlert.value || gameFailed.value || !gameState.playMode) return;
  const overview = wellbeingOverview.value;
  pruneRecoveredCrisisAlerts(overview);
  const alerted = new Set(vitalCrisisAlertedIds.value);
  for (const vital of listPreEmptyCrisisVitals(overview)) {
    if (alerted.has(vital.id)) continue;
    alerted.add(vital.id);
    vitalCrisisAlertedIds.value = alerted;
    vitalCrisisAlert.value = {
      id: vital.id,
      title: preEmptyCrisisTitle(vital),
      message: preEmptyCrisisMessage(vital),
    };
    return;
  }
}

function dismissVitalCrisisAlert() {
  vitalCrisisAlert.value = null;
  showNextVitalCrisisIfNeeded();
}

watch(
  wellbeingOverview,
  () => {
    showNextVitalCrisisIfNeeded();
  },
  { deep: true },
);
const characterDocuments = computed(() => gameState.character.definitions.documents ?? []);
const lessonCompletionError = ref("");
const availableLessons = computed(() =>
  availableHoloReaderLessons(lessons.value, {
    flags: gameState.flags,
    character: gameState.character,
  }),
);
const defaultStoryArc = computed(() =>
  storyArcData.value.storyArcs?.find((arc) => arc.defaultMode === "story") ??
  storyArcData.value.storyArcs?.[0] ??
  null,
);
const holoReaderActions = computed(() =>
  buildHoloReaderActions({
    place: place.value,
    currentStand: indoor.indoor.currentStand,
    lessons: lessons.value,
    flags: gameState.flags,
    character: gameState.character,
    stationPowerOn: stationPowerOverrideOn.value,
  }),
);
const HYDRO_CONSOLE_STAND_ID = "console";
const HYDRO_CONSOLE_CHECKED_FLAG = "hydro.console-checked";
const hydroConsoleActions = computed(() => {
  if (place.value !== "indoors") return [];
  if (indoor.indoor.currentRoom !== "control-room") return [];
  if (indoor.indoor.currentStand !== HYDRO_CONSOLE_STAND_ID) return [];
  if (!stationPowerOverrideOn.value) return [];
  return [{
    id: "hydro-console:open",
    label: "View console",
    kind: "system",
  }];
});
const focusedConsoleActions = computed(() => [
  ...holoReaderActions.value,
  ...hydroConsoleActions.value,
]);
const stationPowerOverrideOn = computed(() =>
  isStationPowerOverriddenOn(gameState, indoor),
);
let deferredWorld = null;
let deferredBuilding = null;

function applyWorld(next) {
  applyOutdoorWorldUpdate(outdoor, next);
  refreshStoryMoment();
}

watch(worldData, (next) => {
  if (outdoor.traveling) deferredWorld = JSON.parse(JSON.stringify(next));
  else applyWorld(next);
});

watch(
  () => outdoor.traveling,
  (traveling) => {
    if (!traveling && deferredWorld) {
      const next = deferredWorld;
      deferredWorld = null;
      applyWorld(next);
    }
  },
);

function applyBuilding(next) {
  indoor.syncFromBuildingData(next);
  syncCharacterHolderDefinitions(gameState.character, next.holders ?? []);
  refreshStoryMoment();
}

watch(buildingData, (next) => {
  if (indoor.indoor.moving) deferredBuilding = JSON.parse(JSON.stringify(next));
  else applyBuilding(next);
});

watch(characterData, (next) => {
  syncCharacterDefinitions(gameState.character, next);
});

watch(
  () => indoor.indoor.moving,
  (moving) => {
    if (!moving && deferredBuilding) {
      const next = deferredBuilding;
      deferredBuilding = null;
      applyBuilding(next);
    }
  },
);

watch(
  () => currentLocationMedia.value?.key ?? null,
  (key, previousKey) => {
    if (!key) {
      locationMediaKey.value = null;
      locationMediaMode.value = "map";
      locationMediaIndex.value = 0;
      return;
    }
    const viewCount = currentLocationMedia.value?.views?.length ?? 0;
    if (key !== previousKey && key !== locationMediaKey.value) {
      locationMediaMode.value = "map";
      locationMediaIndex.value = 0;
    } else if (locationMediaIndex.value >= viewCount) {
      locationMediaIndex.value = Math.max(0, viewCount - 1);
    }
    locationMediaKey.value = key;
  },
  { immediate: true },
);

onMounted(async () => {
  // Title screen first — Welcome decides new vs resume.
  markSessionClean();
  await refreshContent();
  refreshStoryMoment();
});

watch(storyArcDocument, () => {
  refreshStoryMoment();
});

function snapshotFingerprint(snapshot) {
  if (!snapshot) return null;
  const { savedAt: _savedAt, ...rest } = snapshot;
  try {
    return JSON.stringify(rest);
  } catch {
    return null;
  }
}

function markSessionClean() {
  try {
    cleanFingerprint.value = snapshotFingerprint(captureSnapshot(saveCtx.value));
  } catch {
    cleanFingerprint.value = null;
  }
}

function isSessionDirty() {
  // No play session yet (mode chooser) — nothing to lose.
  if (!gameState.playMode) return false;
  if (cleanFingerprint.value == null) return true;
  try {
    return snapshotFingerprint(captureSnapshot(saveCtx.value)) !== cleanFingerprint.value;
  } catch {
    return true;
  }
}

function performSave() {
  const ok = saveGame({
    ...saveCtx.value,
    onSaveComplete: () => markSessionClean(),
  });
  if (ok) markSessionClean();
  return ok;
}

/**
 * Clear play-only UI that must not leak across loads / new games
 * (inventory focus, open modals, stage views, media mode).
 */
function resetPlaySessionUi() {
  inventoryDialogVisible.value = false;
  stageSelectedHoldingId.value = null;
  lookInContainerInstanceId.value = null;
  lookInSelectedHoldingId.value = null;
  itemActionFeedback.value = "";
  containerGroupInspect.value = null;
  developerSettingsVisible.value = false;
  vitalCrisisAlert.value = null;
  vitalCrisisAlertedIds.value = new Set();
  locationMediaMode.value = "map";
  locationMediaIndex.value = 0;
  locationMediaKey.value = null;
  lessonCompletionError.value = "";
  returnToMap({ force: true });
}

/**
 * Wipe a slot and enter a fresh story session in it (no title-screen detour).
 */
function beginFreshGame(gameId) {
  clearSave(gameId);
  setActiveSlot(gameId);
  resetGameState(saveCtx.value);
  resetPlaySessionUi();
  applyPlayMode("story");
}

function applyPlayMode(mode) {
  if (mode === "story") {
    const arc = defaultStoryArc.value;
    setPlayMode(gameState, "story", {
      activeArcId: arc?.id,
      activeBeatId: arc?.startBeat ?? null,
    });
  } else {
    setPlayMode(gameState, "open-world");
  }
  markSessionClean();
  refreshStoryMoment();
}

/**
 * Play a game row: load if saved, or switch into an open game with a fresh session.
 * Prompts to save the active game first when dirty.
 */
function handlePlayGame(gameId) {
  if (gameId === activeSlot.value && gameState.playMode) {
    // Already playing this game — re-load save if present, else stay.
    if (hasSave(gameId) && isSessionDirty()) {
      pendingSaveAction.value = { type: "play", gameId };
      return;
    }
    if (hasSave(gameId)) {
      if (!load(saveCtx.value, gameId)) return;
      resetPlaySessionUi();
      markSessionClean();
      refreshStoryMoment();
      noticeResumingGame(gameId);
    }
    return;
  }

  if (isSessionDirty()) {
    pendingSaveAction.value = { type: "play", gameId };
    return;
  }
  completePlayGame(gameId);
}

/**
 * One-shot HUD line when loading an existing save (title enter or Game menu).
 * Uses source "resume" so indoor room-change / outdoor applyMove clears of
 * "action" (which fire when a snapshot is applied) do not wipe it immediately.
 */
function noticeResumingGame(gameId) {
  pushPlayMessage(`Resuming Game ${gameId}.`, { source: "resume", tone: "notice" });
}

function completePlayGame(gameId) {
  if (hasSave(gameId)) {
    if (!load(saveCtx.value, gameId)) return;
    resetPlaySessionUi();
    markSessionClean();
    refreshStoryMoment();
    noticeResumingGame(gameId);
    return;
  }
  // Open game: start a new story session in this slot (stay in play view).
  beginFreshGame(gameId);
}

function handleRestartGame(gameId) {
  // Menu only shows Restart when occupied; failure panel may call with a live slot.
  if (!hasSave(gameId) && gameId === activeSlot.value && gameState.playMode) {
    beginFreshGame(gameId);
    return;
  }
  if (!hasSave(gameId)) return;
  restartDialog.value = { gameId };
}

function handleRestartConfirm() {
  const gameId = restartDialog.value?.gameId;
  restartDialog.value = null;
  if (gameId == null) return;
  if (isSessionDirty() && gameId !== activeSlot.value) {
    pendingSaveAction.value = { type: "restart", gameId };
    return;
  }
  // Active-game restart (or clean session): wipe and start fresh.
  beginFreshGame(gameId);
}

/**
 * New Game toolbar: first open game, or pick when all three have saves.
 */
function handleNewGameRequest() {
  const openId = firstOpenSlot();
  if (openId != null) {
    if (isSessionDirty()) {
      pendingSaveAction.value = { type: "new-open", gameId: openId };
      return;
    }
    beginFreshGame(openId);
    return;
  }
  // All games have saves — ask which to replace.
  if (isSessionDirty()) {
    pendingSaveAction.value = { type: "new-pick" };
    return;
  }
  pickGameDialog.value = { mode: null };
}

function completePendingAfterSaveDecision({ saved }) {
  const action = pendingSaveAction.value;
  pendingSaveAction.value = null;
  if (!action) return;
  if (saved === true && !performSave()) return;
  // saved === false means discard and continue; saved === true already saved

  if (action.type === "play") {
    completePlayGame(action.gameId);
    return;
  }
  if (action.type === "restart") {
    beginFreshGame(action.gameId);
    return;
  }
  if (action.type === "new-open") {
    beginFreshGame(action.gameId);
    return;
  }
  if (action.type === "new-pick") {
    pickGameDialog.value = { mode: action.mode ?? null };
  }
}

function handlePickGameForNew(gameId) {
  const mode = pickGameDialog.value?.mode ?? null;
  pickGameDialog.value = null;
  beginFreshGame(gameId);
  if (mode) applyPlayMode(mode);
}

/** Failure panel: wipe the active game and start over in the same slot. */
function handleFailureRestart() {
  vitalCrisisAlert.value = null;
  vitalCrisisAlertedIds.value = new Set();
  beginFreshGame(activeSlot.value);
}

/**
 * Failure panel: start a New Game in an open slot (or pick a slot to replace).
 * Does not prompt to save the failed run.
 */
function handleFailureNewGame() {
  vitalCrisisAlert.value = null;
  vitalCrisisAlertedIds.value = new Set();
  const openId = firstOpenSlot();
  if (openId != null) {
    beginFreshGame(openId);
    return;
  }
  pickGameDialog.value = { mode: null };
}

/**
 * Title screen: Welcome (no interstitial).
 * - No saves → new story in Game 1
 * - One save → resume that game
 * - Several saves → resume the most recently saved
 */
function enterTheGame() {
  const occupied = saveSlots.value.filter((s) => s.occupied);
  if (occupied.length === 0) {
    beginFreshGame(1);
    return;
  }

  let gameId;
  if (occupied.length === 1) {
    gameId = occupied[0].id;
  } else {
    gameId = mostRecentlySavedSlot() ?? occupied[0].id;
  }

  if (!load(saveCtx.value, gameId)) {
    // Corrupt / unreadable save — fall back to a clean story start.
    const openId = firstOpenSlot();
    beginFreshGame(openId ?? 1);
    return;
  }
  resetPlaySessionUi();
  markSessionClean();
  refreshStoryMoment();
  noticeResumingGame(gameId);
}

function handleHeaderSave() {
  performSave();
}

function handleReturnToMap() {
  returnToMap();
  lessonCompletionError.value = "";
  nextTick(() => document.querySelector(".player-character")?.focus());
}

function showLocationImage() {
  if (!currentLocationMedia.value?.views?.length) return;
  locationMediaKey.value = currentLocationMedia.value.key;
  if (locationMediaIndex.value >= currentLocationMedia.value.views.length) locationMediaIndex.value = 0;
  locationMediaMode.value = "image";
}

function showLocationMap() {
  locationMediaMode.value = "map";
}

function stepLocationImage(delta) {
  const count = currentLocationMedia.value?.views?.length ?? 0;
  if (count < 2) return;
  locationMediaIndex.value = (locationMediaIndex.value + delta + count) % count;
  locationMediaMode.value = "image";
}

function currentWorldHolderId() {
  return ensureWorldHolder(gameState.character.holdings, {
    place: place.value,
    hex: place.value === "outdoors" ? outdoor.state.currentId : null,
    room: place.value === "indoors" ? indoor.indoor.currentRoom : null,
    exteriorNode: place.value === "indoors" ? indoor.indoor.exteriorNode : null,
    stand: place.value === "indoors" ? indoor.indoor.currentStand : outdoor.state.stand?.id,
  });
}

function publicAssetPath(path) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path.replace(/^\.?\//, "")}`;
}

function mergeAllowedItemActions(allowed, itemActions = []) {
  if (!itemActions.length) return allowed ?? null;
  return {
    ...(allowed ?? {}),
    itemActions: [...new Set([
      ...(allowed?.itemActions ?? []),
      ...itemActions,
    ])],
  };
}

function itemActionIdsForWellbeing(character) {
  return (character.definitions?.items ?? []).flatMap((item) =>
    (item.actions ?? [])
      .filter((action) => actionAffectsWellbeing(action))
      .map((action) => `${item.id}.${action.id}`),
  );
}

function actionAffectsWellbeing(action) {
  return (action.effects ?? []).some((effect) =>
    String(effect?.op ?? "").startsWith("stat.") &&
    WELLBEING_STAT_IDS.has(effect.id)
  );
}

function openStageView(view, { force = false } = {}) {
  const kind = view?.kind;
  if (!kind) return false;
  if (!force && !isStageViewAllowed(wellbeingAvailableActions.value, view)) return false;
  if (kind === "inventory") {
    currentWorldHolderId();
    return openInventory(view);
  }
  if (kind === "character-stats") return openCharacterStats(view);
  if (kind === "character") return openCharacter(view);
  return openView(kind, view);
}

function handleHoloReaderAction(id) {
  if (!isActionAllowed(id, wellbeingAvailableActions.value)) return;
  if (id === HOLO_READER_BROWSER_ACTION_ID) {
    openView("lesson", { source: "library-holo-reader" });
  }
  if (id === "hydro-console:open") {
    // Durable signal for story beat check-console: only the player action
    // (stand at console + View console) should open this stage.
    gameState.flags?.add?.(HYDRO_CONSOLE_CHECKED_FLAG);
    openView("console", {
      panelId: "hydro-control-room-panel",
      focus: "generation",
      mode: "startup",
    });
    refreshStoryMoment();
  }
}

function selectLesson(lessonId) {
  if (!isStageViewAllowed(wellbeingAvailableActions.value, {
    kind: "lesson",
    id: lessonId,
  })) return;
  openView("lesson", lessonId ? {
    ...activeView.value.payload,
    lessonId,
  } : {
    source: activeView.value.payload?.source ?? "library-holo-reader",
  });
}

function handleCompleteLesson(lessonId) {
  if (!isStageViewAllowed(wellbeingAvailableActions.value, {
    kind: "lesson",
    id: lessonId,
  })) return;
  const lesson = lessons.value.find((candidate) => candidate.id === lessonId);
  if (!lesson) {
    lessonCompletionError.value = `Lesson "${lessonId}" was not found.`;
    return;
  }
  const result = completeLesson(gameState, lesson);
  lessonCompletionError.value = result.ok ? "" : result.error ?? "Lesson completion failed.";
}

function handleSetStationPowerOverride(on) {
  const result = setStationPowerOverride({ gameState, indoor }, on);
  if (result.ok) refreshStoryMoment();
}

function handleSetVital({ id, value }) {
  const definition = gameState.character.definitions.stats?.find((stat) => stat.id === id);
  if (!definition) return;
  const min = Number.isFinite(Number(definition.min)) ? Number(definition.min) : 0;
  const max = Number.isFinite(Number(definition.max)) ? Number(definition.max) : 100;
  const next = Math.min(max, Math.max(min, Number(value)));
  if (!Number.isFinite(next)) return;
  gameState.character.stats[id] = next;
  markCharacterChanged(gameState.character);
  refreshStoryMoment();
}

function handleAdjustVital({ id, delta }) {
  const current = Number(gameState.character.stats?.[id] ?? 0);
  handleSetVital({ id, value: current + Number(delta) });
}

function handleUseItem({ itemId, actionId, holderId = null, recordId = null, optionId = null }) {
  if (!isActionAllowed(`item-action:${itemId}.${actionId}`, wellbeingAvailableActions.value, {
    itemId,
    actionId,
  })) {
    itemActionFeedback.value = "That action is not available right now.";
    return;
  }
  const result = performItemAction(gameState, itemId, actionId, { holderId, recordId, optionId });
  if (!result.ok) {
    itemActionFeedback.value = result.error || "That did not work.";
    return;
  }
  itemActionFeedback.value = result.notice || "";
  markCharacterChanged(gameState.character);
  refreshStoryMoment();
  if (result.view) openStageView(result.view);
}

function handleWellbeingAction(payload) {
  const actionId = typeof payload === "string" ? payload : payload?.actionId;
  const minutes = typeof payload === "object" ? payload?.minutes : undefined;

  let result;
  if (actionId === "eat" || actionId === "drink") {
    result = performQuickConsume(gameState, actionId, {
      nearbyHolderIds: [...nearbyHolderIds.value, currentWorldHolderId()],
    });
  } else {
    result = performWellbeingAction(gameState, actionId, { minutes });
  }

  if (!result.ok) {
    wellbeingActionFeedback.value = result.error || "That did not work.";
    return;
  }
  wellbeingActionFeedback.value = result.notice || "";
  markCharacterChanged(gameState.character);
  refreshStoryMoment();
}

function handleTransferItem({ type, recordId, quantity, toHolder }) {
  const target = toHolder === "__ground__" ? currentWorldHolderId() : toHolder;
  try {
    transferHolding(gameState.character.holdings, gameState.character.definitions, {
      type,
      id: recordId,
      quantity,
      toHolder: target,
    });
    markCharacterChanged(gameState.character);
    refreshStoryMoment();
  } catch (error) {
    console.warn(error);
  }
}

function handlePickupOutdoorHolding(encoded) {
  const [type, ...idParts] = String(encoded).split(":");
  const id = idParts.join(":");
  const record = outdoorGroundHoldings.value
    .find((entry) => entry.type === type && entry.id === id);
  if (!record) return;
  try {
    const quantity = record.type === "stack"
      ? 1
      : (record.quantity ?? 1);
    transferHolding(gameState.character.holdings, gameState.character.definitions, {
      type,
      id,
      quantity,
      toHolder: characterHolderId(gameState.character.holdings),
    });
    markCharacterChanged(gameState.character);
    refreshStoryMoment();
  } catch (error) {
    console.warn(error);
  }
}

function openInventoryDialog(focusHoldingKey = null) {
  if (focusHoldingKey) {
    stageSelectedHoldingId.value = focusHoldingKey;
  } else if (!stageSelectedHolding.value) {
    // Stale selection from a prior session, or empty focus — pick first live item.
    const firstHolding = inventoryHolders.value
      .flatMap((holder) => holder.records)
      .at(0);
    stageSelectedHoldingId.value = firstHolding
      ? `${firstHolding.type}:${firstHolding.id}`
      : null;
  }
  inventoryDialogVisible.value = true;
}

function openCharacterSheet() {
  openCharacter({ tab: "overview" });
}

const lookInContainerView = computed(() => {
  const instanceId = lookInContainerInstanceId.value;
  if (!instanceId) return null;
  const containerHolder = inventoryHolders.value
    .find((holder) => holder.id === `container:${instanceId}`);
  if (!containerHolder) return null;

  let containerRecord = null;
  let locationLabel = "";
  for (const holder of inventoryHolders.value) {
    if (holder.kind === "container") continue;
    const record = (holder.records ?? []).find(
      (entry) => entry.type === "instance" && entry.id === instanceId,
    );
    if (!record) continue;
    containerRecord = { ...record, holder };
    if (holder.kind === "fixed" || holder.kind === "vehicle" || holder.kind === "world") {
      const location = holder.location ?? {};
      locationLabel = holder.label
        || [location.room, location.stand].filter(Boolean).join(" · ")
        || holder.id;
    } else if (holder.kind === "character") {
      locationLabel = "Carried";
    }
    break;
  }

  const contents = (containerHolder.records ?? []).map((record) => ({
    ...record,
    holder: containerHolder,
  }));
  const baseLabel = containerRecord?.label
    ?? containerRecord?.definition?.label
    ?? containerHolder.label
    ?? "Container";
  const label = containerInstanceLabel(
    gameState.character.holdings,
    gameState.character.definitions,
    instanceId,
    {
      baseLabel,
      itemId: containerRecord?.item ?? null,
    },
  );
  return {
    instanceId,
    label,
    locationLabel,
    contents,
    containerRecord,
  };
});

const lookInSelectedHolding = computed(() => {
  const view = lookInContainerView.value;
  if (!view) return null;
  const selectedId = lookInSelectedHoldingId.value;
  const match = view.contents.find((record) => `${record.type}:${record.id}` === selectedId);
  if (match) return match;
  return view.contents[0] ?? null;
});

const lookInSelectedHoldingKey = computed(() => {
  const holding = lookInSelectedHolding.value;
  return holding ? `${holding.type}:${holding.id}` : null;
});

watch(lookInContainerView, (view) => {
  if (!view) return;
  const stillThere = view.contents.some(
    (record) => `${record.type}:${record.id}` === lookInSelectedHoldingId.value,
  );
  if (!stillThere) {
    lookInSelectedHoldingId.value = view.contents[0]
      ? `${view.contents[0].type}:${view.contents[0].id}`
      : null;
  }
});

/** Look into a container without the full inventory (play-panel Look in). */
function handleLookInHolding(lookIn) {
  const instanceId = lookIn?.id
    ?? (typeof lookIn?.key === "string" && lookIn.key.startsWith("instance:")
      ? lookIn.key.slice("instance:".length)
      : null);
  if (!instanceId) return;
  lookInContainerInstanceId.value = instanceId;
  const holder = inventoryHolders.value.find((entry) => entry.id === `container:${instanceId}`);
  const first = holder?.records?.[0];
  lookInSelectedHoldingId.value = first ? `${first.type}:${first.id}` : null;
}

function closeLookInContainer() {
  lookInContainerInstanceId.value = null;
  lookInSelectedHoldingId.value = null;
}

function handleInspectContainerGroup(group) {
  containerGroupInspect.value = group ?? null;
}

function closeContainerGroupInspect() {
  containerGroupInspect.value = null;
}

function handleGroupLookIn(entry) {
  if (!entry?.id) return;
  containerGroupInspect.value = null;
  handleLookInHolding({ type: entry.type || "instance", id: entry.id, key: entry.key });
}

function handleGroupPickUp(entry) {
  if (!entry?.type || !entry?.id) return;
  try {
    transferHolding(gameState.character.holdings, gameState.character.definitions, {
      type: entry.type,
      id: entry.id,
      quantity: 1,
      toHolder: characterHolderId(gameState.character.holdings),
    });
    markCharacterChanged(gameState.character);
    refreshStoryMoment();
    containerGroupInspect.value = null;
  } catch (error) {
    console.warn(error);
  }
}
</script>

<template>
  <main class="game-shell">
    <AppHeader
      :active-slot="activeSlot"
      :slots="saveSlots"
      :last-saved-at="lastSavedAt"
      :load-error="loadError"
      :movement-audit-visible="movementAuditVisible"
      :play-mode="gameState.playMode"
      :portrait-src="characterPortraitSrc"
      :character-name="characterDisplayName"
      @save="handleHeaderSave"
      @play-game="handlePlayGame"
      @restart-game="handleRestartGame"
      @new-game="handleNewGameRequest"
      @show-character="openCharacterSheet"
      @show-inventory="openInventoryDialog"
      @show-dev-settings="developerSettingsVisible = true"
      @toggle-movement-audit="movementAuditVisible = !movementAuditVisible" />

    <SaveGamesDialog
      v-if="pendingSaveAction"
      mode="save-before-switch"
      eyebrow="Before you go"
      title="Save current game?"
      :message="`Game ${activeSlot} has progress that is not saved.`"
      discard-label="Don't save"
      @save="completePendingAfterSaveDecision({ saved: true })"
      @discard="completePendingAfterSaveDecision({ saved: false })"
      @cancel="pendingSaveAction = null" />

    <SaveGamesDialog
      v-if="pickGameDialog"
      mode="pick-game"
      eyebrow="New Game"
      title="All games are in use"
      message="Choose a game to replace. Its saved progress will be erased."
      :slots="saveSlots"
      :active-game="activeSlot"
      @choose-game="handlePickGameForNew"
      @cancel="pickGameDialog = null" />

    <SaveGamesDialog
      v-if="restartDialog"
      mode="confirm"
      eyebrow="Restart"
      :title="`Restart Game ${restartDialog.gameId}?`"
      message="Saved progress will be erased."
      confirm-label="Restart"
      @confirm="handleRestartConfirm"
      @cancel="restartDialog = null" />

    <DeveloperSettingsDialog
      v-if="developerSettingsVisible"
      :station-power-on="stationPowerOverrideOn"
      :vitals="wellbeingOverview.vitals"
      @set-station-power="handleSetStationPowerOverride"
      @set-vital="handleSetVital"
      @adjust-vital="handleAdjustVital"
      @close="developerSettingsVisible = false" />

    <InventoryDialog
      v-if="inventoryDialogVisible"
      :holders="inventoryHolders"
      :selected-holding="stageSelectedHolding"
      :selected-holding-id="stageSelectedHoldingId"
      :transfer-targets="transferTargets"
      :public-asset-path="publicAssetPath"
      :action-policy="wellbeingAvailableActions"
      :action-feedback="itemActionFeedback"
      @select-holding="stageSelectedHoldingId = $event; itemActionFeedback = ''"
      @use-item="handleUseItem"
      @transfer-item="handleTransferItem"
      @close="inventoryDialogVisible = false; itemActionFeedback = ''" />

    <ContainerContentsDialog
      v-if="lookInContainerView"
      :container-label="lookInContainerView.label"
      :location-label="lookInContainerView.locationLabel"
      :contents="lookInContainerView.contents"
      :selected-holding="lookInSelectedHolding"
      :selected-holding-id="lookInSelectedHoldingKey"
      :character-holder-id="characterHolderId(gameState.character.holdings)"
      :public-asset-path="publicAssetPath"
      @select-holding="lookInSelectedHoldingId = $event"
      @transfer-item="handleTransferItem"
      @close="closeLookInContainer" />

    <ContainerGroupDialog
      v-if="containerGroupInspect"
      :title="containerGroupInspect.title"
      :intro="containerGroupInspect.intro"
      :entries="containerGroupInspect.entries"
      @look-in="handleGroupLookIn"
      @pick-up="handleGroupPickUp"
      @close="closeContainerGroupInspect" />

    <div
      v-if="contentError || worldContentError || buildingContentError || characterContentError || learningContentError || storyArcContentError"
      class="content-error">
      {{ contentError || worldContentError || buildingContentError || characterContentError || learningContentError || storyArcContentError }}
      <button
        class="sm"
        @click="contentError
          ? refreshContent()
          : worldContentError
            ? refreshWorld()
            : buildingContentError
              ? refreshBuilding()
              : characterContentError
                ? refreshCharacter()
                : learningContentError
                  ? refreshLearning()
                  : refreshStoryArcs()"
      >Retry</button>
    </div>

    <TitleScreen
      v-if="!gameState.playMode"
      @enter="enterTheGame" />

    <section
      v-if="storyError"
      class="story-error"
      role="alert">
      {{ storyError }}
    </section>

    <section
      v-if="vitalCrisisAlert && !gameFailed"
      class="vital-crisis-backdrop"
      role="presentation"
      @click.self="dismissVitalCrisisAlert">
      <section
        class="vital-crisis-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vital-crisis-title">
        <p class="vital-crisis-kicker">Wellbeing</p>
        <h2 id="vital-crisis-title">{{ vitalCrisisAlert.title }}</h2>
        <p>{{ vitalCrisisAlert.message }}</p>
        <div class="vital-crisis-actions">
          <button type="button" class="sm" @click="dismissVitalCrisisAlert">
            Got it
          </button>
        </div>
      </section>
    </section>

    <section
      v-if="gameFailed"
      class="failure-panel"
      role="alert"
      aria-labelledby="failure-title">
      <p class="failure-kicker">Zanzibar cannot keep going</p>
      <h2 id="failure-title">The trail goes dark.</h2>
      <p>
        {{ catastrophicVitals.map((vital) => `${vital.label.toLowerCase()} is ${vital.state.toLowerCase()}`).join(", ") }}.
        Restart this game, or start a new one in another slot.
      </p>
      <div class="failure-actions">
        <button type="button" class="sm" @click="handleFailureRestart">
          Restart Game {{ activeSlot }}
        </button>
        <button type="button" class="sm muted" @click="handleFailureNewGame">
          New Game
        </button>
      </div>
    </section>

    <OutdoorScene
      v-if="gameState.playMode && !gameFailed && isMapView && place === 'outdoors'"
      :outdoor="outdoor"
      :indoor="indoor"
      :narrative-beat="narrativeBeat"
      :pending-beat="pendingBeat"
      :clock="gameState.clock"
      :apply-choice="applyChoice"
      :travel-to-hex="travelToHex"
      :enter-building="enterBuilding"
      :audit-enabled="movementAuditVisible"
      :action-policy="wellbeingAvailableActions"
      :wellbeing-overview="wellbeingOverview"
      :nearby-holdings="outdoorGroundHoldings"
      :pickup-holding="handlePickupOutdoorHolding"
      :refresh-story="refreshStoryMoment"
      :location-media="currentLocationMedia"
      :location-media-mode="locationMediaMode"
      :location-media-index="locationMediaIndex"
      @stage-view="openStageView"
      @show-location-map="showLocationMap"
      @show-location-image="showLocationImage"
      @previous-location-image="stepLocationImage(-1)"
      @next-location-image="stepLocationImage(1)"
      @hide-movement-audit="movementAuditVisible = false" />

    <IndoorScene
      v-else-if="gameState.playMode && !gameFailed && isMapView"
      :indoor="indoor"
      :narrative-beat="narrativeBeat"
      :pending-beat="pendingBeat"
      :clock="gameState.clock"
      :apply-choice="applyChoice"
      :travel-to-room="travelToRoom"
      :audit-enabled="movementAuditVisible"
      :extra-actions="focusedConsoleActions"
      :action-policy="wellbeingAvailableActions"
      :wellbeing-overview="wellbeingOverview"
      :location-media="currentLocationMedia"
      :location-media-mode="locationMediaMode"
      :location-media-index="locationMediaIndex"
      :refresh-story="refreshStoryMoment"
      @extra-action="handleHoloReaderAction"
      @stage-view="openStageView"
      @look-in-holding="handleLookInHolding"
      @inspect-container-group="handleInspectContainerGroup"
      @show-location-map="showLocationMap"
      @show-location-image="showLocationImage"
      @previous-location-image="stepLocationImage(-1)"
      @next-location-image="stepLocationImage(1)"
      @hide-movement-audit="movementAuditVisible = false" />

    <InventoryStageView
      v-else-if="gameState.playMode && !gameFailed && activeView.kind === 'inventory'"
      :holders="inventoryHolders"
      :selected-holding="stageSelectedHolding"
      :selected-holding-id="stageSelectedHoldingId"
      :transfer-targets="transferTargets"
      :public-asset-path="publicAssetPath"
      :action-policy="wellbeingAvailableActions"
      @select-holding="stageSelectedHoldingId = $event"
      @use-item="handleUseItem"
      @transfer-item="handleTransferItem"
      @return-to-map="handleReturnToMap" />

    <CharacterStatsStageView
      v-else-if="gameState.playMode && !gameFailed && activeView.kind === 'character-stats'"
      :stats="characterStats"
      :focus="activeView.payload?.focus"
      @return-to-map="handleReturnToMap" />

    <CharacterView
      v-else-if="gameState.playMode && !gameFailed && isCharacterView"
      :character="gameState.character"
      :clock="gameState.clock"
      :nearby-holder-ids="[...nearbyHolderIds, currentWorldHolderId()]"
      :initial-tab="activeView.payload?.tab"
      :action-policy="wellbeingAvailableActions"
      :wellbeing-action-feedback="wellbeingActionFeedback"
      @use-item="handleUseItem"
      @transfer-item="handleTransferItem"
      @wellbeing-action="handleWellbeingAction"
      @return-to-map="handleReturnToMap" />

    <HoloReaderView
      v-else-if="gameState.playMode && !gameFailed && activeView.kind === 'lesson'"
      :lessons="availableLessons"
      :selected-lesson-id="activeView.payload?.lessonId ?? activeView.payload?.id"
      :game-state="gameState"
      :completion-error="lessonCompletionError"
      @select-lesson="selectLesson"
      @complete-lesson="handleCompleteLesson"
      @return-to-map="handleReturnToMap" />

    <HydroConsoleView
      v-else-if="gameState.playMode && !gameFailed && activeView.kind === 'console'"
      :game-state="gameState"
      :payload="activeView.payload"
      :station-context="{
        facility: indoor.indoor?.facility ?? indoor.facility,
        activeStageKind: activeView.kind,
        flags: gameState.flags,
      }"
      @return-to-map="handleReturnToMap" />

    <InstructionCardView
      v-else-if="gameState.playMode && !gameFailed && activeView.kind === 'document'"
      :documents="characterDocuments"
      :payload="activeView.payload"
      @return-to-map="handleReturnToMap" />

    <StoryOverlay
      v-if="gameState.playMode && !gameFailed && pendingCompletion"
      :completion="pendingCompletion"
      @dismiss-completion="dismissCompletion" />
  </main>
</template>

<style scoped>
.story-error {
  border: 1px solid #9f6a5d;
  background: #39251f;
  color: #ffd6cd;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.75rem;
}
.failure-kicker {
  color: #d7b77f;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
.failure-panel {
  width: min(42rem, calc(100% - 2rem));
  margin: 4rem auto;
  border: 1px solid #9f6a5d;
  border-radius: 8px;
  background: #2d2020;
  color: #f7e9e6;
  padding: 1.25rem;
}
.failure-panel h2,
.failure-panel p {
  margin: 0;
}
.failure-panel h2 {
  margin-top: 0.25rem;
  font-size: 1.35rem;
}
.failure-panel p:not(.failure-kicker) {
  margin-top: 0.75rem;
  color: #dec6c1;
  line-height: 1.5;
}
.failure-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.vital-crisis-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(12 18 26 / 0.52);
}
.vital-crisis-dialog {
  width: min(28rem, 100%);
  padding: 1.1rem 1.2rem;
  border: 1px solid #c4a15a;
  border-radius: 8px;
  background: #2a2418;
  color: #f7f0df;
  box-shadow: 0 18px 50px rgb(15 23 42 / 0.35);
}
.vital-crisis-kicker {
  margin: 0 0 0.2rem;
  color: #d7b77f;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.vital-crisis-dialog h2 {
  margin: 0 0 0.55rem;
  font-size: 1.2rem;
  color: #fff6df;
}
.vital-crisis-dialog p:not(.vital-crisis-kicker) {
  margin: 0;
  color: #e8dcc0;
  line-height: 1.5;
}
.vital-crisis-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}
</style>
