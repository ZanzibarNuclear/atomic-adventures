<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { useIndoorBuilding } from "../lib/maps/composables/useIndoorBuilding.js";
import { createGameState, resetGameState, setPlayMode } from "../composables/useGameState.js";
import { useSaveGame } from "../composables/useSaveGame.js";
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
import { performItemAction } from "../lib/character/itemActions.js";
import {
  accessibleHolderIds,
  characterHolderId,
  ensureWorldHolder,
  holdingRecords,
  transferHolding,
} from "../lib/character/holdings.js";
import AppHeader from "../components/AppHeader.vue";
import CharacterView from "../components/game-views/CharacterView.vue";
import CharacterStatsStageView from "../components/game-views/CharacterStatsStageView.vue";
import DeveloperSettingsDialog from "../components/dev/DeveloperSettingsDialog.vue";
import HoloReaderView from "../components/game-views/HoloReaderView.vue";
import HydroConsoleView from "../components/game-views/HydroConsoleView.vue";
import InstructionCardView from "../components/game-views/InstructionCardView.vue";
import InventoryDialog from "../components/game-views/InventoryDialog.vue";
import InventoryStageView from "../components/game-views/InventoryStageView.vue";
import VitalsDialog from "../components/game-views/VitalsDialog.vue";
import StoryOverlay from "../components/story/StoryOverlay.vue";
import OutdoorScene from "../lib/maps/views/OutdoorScene.vue";
import IndoorScene from "../lib/maps/views/IndoorScene.vue";
import {
  characterWellbeingOverview,
  visibleCharacterStats,
} from "../lib/character/panel.js";
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
const vitalsDialogVisible = ref(false);
const inventoryDialogVisible = ref(false);
const itemActionFeedback = ref("");
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
const { lastSavedAt, loadError, hasSave, save: saveGame, load, clearSave } = save;

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
const currentLocationMedia = computed(() =>
  place.value === "indoors"
    ? resolveIndoorLocationMedia(indoor)
    : resolveOutdoorLocationMedia(outdoor),
);

function applyChoice(index = 0) {
  if (gameState.playMode === "open-world") {
    openWorldStory.applyChoice(index);
    return;
  }
  const choice = activeChoices.value?.[Number(index)];
  if (!choice) return;
  applyStoryAction(`story:${choice.id}`);
}

function travelToHex(hexId) {
  if (gameState.playMode === "open-world") {
    if (!outdoor.canReachHex(hexId)) return;
    outdoor.moveTo(hexId);
    return;
  }
  const choice = activeChoices.value?.find((candidate) => candidate.go_hex === hexId);
  if (choice) {
    applyStoryAction(`story:${choice.id}`);
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
  const choice = activeChoices.value?.find((candidate) => candidate.enter);
  if (choice) {
    applyStoryAction(`story:${choice.id}`);
    return;
  }
  indoor.enterBuilding();
}

function travelToRoom(roomId) {
  if (gameState.playMode === "open-world") {
    indoor.moveToRoom(roomId);
    return;
  }
  const choice = activeChoices.value?.find((candidate) => candidate.go_room === roomId);
  if (choice) {
    applyStoryAction(`story:${choice.id}`);
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
  return ids.map((id) => ({
    ...(gameState.character.holdings.holders[id] ?? { id, label: id, kind: "holder" }),
    records: holdingRecords(
      gameState.character.holdings,
      gameState.character.definitions,
      [id],
    ).map((record) => ({
      ...record,
      label: record.definition?.label ?? record.item,
      description: record.definition?.description ?? "",
      kind: record.definition?.kind ?? "item",
      icon: record.definition?.icon ?? null,
      actions: record.definition?.actions ?? [],
    })),
  }));
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
const wellbeingAlerts = computed(() =>
  wellbeingOverview.value.vitals
    .map((vital) => ({
      id: vital.id,
      label: vital.label,
      state: vital.state,
      tone: vital.tone,
      status: vitalPillStatus(vital),
    })),
);

function vitalPillStatus(vital) {
  if (vital.tone === "error") {
    return Number(vital.value) <= Number(vital.min ?? 0) ? "worst" : "warning";
  }
  if (vital.tone === "warning") return "caution";
  const min = Number(vital.min ?? 0);
  const max = Number(vital.max ?? 100);
  const value = Number(vital.value ?? max);
  const span = max - min;
  if (span > 0 && (value - min) / span < 0.8) return "fine";
  return "good";
}
const catastrophicVitals = computed(() =>
  [wellbeingOverview.value.health].filter((vital) =>
    Number(vital.value) <= Number(vital.min ?? 0),
  ),
);
const gameFailed = computed(() => catastrophicVitals.value.length > 0);
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
const hydroConsoleActions = computed(() => {
  if (place.value !== "indoors") return [];
  if (indoor.indoor.currentRoom !== "control-room") return [];
  if (!stationPowerOverrideOn.value) return [];
  return [{
    id: "hydro-console:open",
    label: "Open the generator console",
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
  if (hasSave()) load(saveCtx.value);
  await refreshContent();
  refreshStoryMoment();
});

watch(storyArcDocument, () => {
  refreshStoryMoment();
});

function handleNewGame() {
  if (hasSave() && !window.confirm("Start a new game? Your saved progress will be erased.")) return;
  clearSave();
  resetGameState(saveCtx.value);
  refreshStoryMoment();
}

function handleReset() {
  if (!hasSave() || !load(saveCtx.value)) resetGameState(saveCtx.value);
  refreshStoryMoment();
}

function choosePlayMode(mode) {
  if (mode === "story") {
    const arc = defaultStoryArc.value;
    setPlayMode(gameState, "story", {
      activeArcId: arc?.id,
      activeBeatId: arc?.startBeat ?? null,
    });
  } else {
    setPlayMode(gameState, "open-world");
  }
  refreshStoryMoment();
}

function handleReturnToMap() {
  returnToMap();
  lessonCompletionError.value = "";
  nextTick(() => document.querySelector(".player-health")?.focus());
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
    return openCharacter({ ...view, tab: "inventory" });
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
    openView("console", {
      panelId: "hydro-control-room-panel",
      focus: "generation",
      mode: "startup",
    });
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
  })) return;
  const beforeStats = { ...(gameState.character.stats ?? {}) };
  const result = performItemAction(gameState, itemId, actionId, { holderId, recordId, optionId });
  if (result.ok) {
    itemActionFeedback.value = itemActionResultLine(beforeStats, gameState.character.stats);
    refreshStoryMoment();
    if (result.view) openStageView(result.view);
  }
}

function itemActionResultLine(beforeStats, afterStats = {}) {
  const changes = (gameState.character.definitions.stats ?? [])
    .filter((stat) => WELLBEING_STAT_IDS.has(stat.id))
    .map((stat) => {
      const before = Number(beforeStats?.[stat.id]);
      const after = Number(afterStats?.[stat.id]);
      if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) return null;
      const delta = after - before;
      return `${stat.label ?? stat.id} ${delta > 0 ? "+" : ""}${formatStatChange(delta)} (${formatStatChange(before)} -> ${formatStatChange(after)})`;
    })
    .filter(Boolean);
  return changes.length ? changes.join(", ") : "Nothing changes.";
}

function formatStatChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(number);
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
    transferHolding(gameState.character.holdings, gameState.character.definitions, {
      type,
      id,
      quantity: record.quantity ?? 1,
      toHolder: characterHolderId(gameState.character.holdings),
    });
    markCharacterChanged(gameState.character);
    refreshStoryMoment();
  } catch (error) {
    console.warn(error);
  }
}

function openInventoryDialog() {
  itemActionFeedback.value = "";
  inventoryDialogVisible.value = true;
  if (stageSelectedHolding.value) return;
  const firstHolding = inventoryHolders.value
    .flatMap((holder) => holder.records)
    .at(0);
  stageSelectedHoldingId.value = firstHolding
    ? `${firstHolding.type}:${firstHolding.id}`
    : null;
}
</script>

<template>
  <main class="game-shell">
    <AppHeader
      :has-save="hasSave()"
      :last-saved-at="lastSavedAt"
      :load-error="loadError"
      :movement-audit-visible="movementAuditVisible"
      :play-mode="gameState.playMode"
      @save="saveGame(saveCtx)"
      @new-game="handleNewGame"
      @reset="handleReset"
      @show-health="vitalsDialogVisible = true"
      @show-inventory="openInventoryDialog"
      @show-dev-settings="developerSettingsVisible = true"
      @show-movement-audit="movementAuditVisible = true" />

    <DeveloperSettingsDialog
      v-if="developerSettingsVisible"
      :station-power-on="stationPowerOverrideOn"
      :vitals="wellbeingOverview.vitals"
      @set-station-power="handleSetStationPowerOverride"
      @set-vital="handleSetVital"
      @adjust-vital="handleAdjustVital"
      @close="developerSettingsVisible = false" />

    <VitalsDialog
      v-if="vitalsDialogVisible"
      :alerts="wellbeingAlerts"
      @close="vitalsDialogVisible = false" />

    <InventoryDialog
      v-if="inventoryDialogVisible"
      :holders="inventoryHolders"
      :selected-holding="stageSelectedHolding"
      :selected-holding-id="stageSelectedHoldingId"
      :transfer-targets="transferTargets"
      :public-asset-path="publicAssetPath"
      :action-policy="wellbeingAvailableActions"
      :action-feedback="itemActionFeedback"
      @select-holding="stageSelectedHoldingId = $event"
      @use-item="handleUseItem"
      @transfer-item="handleTransferItem"
      @close="inventoryDialogVisible = false" />

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

    <section
      v-if="!gameState.playMode"
      class="mode-choice"
      aria-labelledby="mode-choice-title">
      <div class="mode-choice-panel">
        <p class="mode-choice-kicker">New game</p>
        <h2 id="mode-choice-title">Choose how to play</h2>
        <div class="mode-choice-options">
          <button
            type="button"
            class="mode-choice-card recommended"
            @click="choosePlayMode('story')">
            <span class="mode-choice-label">Story</span>
            <span class="mode-choice-note">Follow Zanzibar's story through guided exploration.</span>
          </button>
          <button
            type="button"
            class="mode-choice-card"
            @click="choosePlayMode('open-world')">
            <span class="mode-choice-label">Open-world</span>
            <span class="mode-choice-note">Freeform exploration and experimentation without the canonical sequence.</span>
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="storyError"
      class="story-error"
      role="alert">
      {{ storyError }}
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
        Restoring from the last save or starting again is the way forward.
      </p>
      <div class="failure-actions">
        <button type="button" class="sm" @click="handleReset">Retry from save</button>
        <button type="button" class="sm muted" @click="handleNewGame">New game</button>
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
      :location-media="currentLocationMedia"
      :location-media-mode="locationMediaMode"
      :location-media-index="locationMediaIndex"
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
      @extra-action="handleHoloReaderAction"
      @stage-view="openStageView"
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
      :action-feedback="itemActionFeedback"
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
      :action-feedback="itemActionFeedback"
      @use-item="handleUseItem"
      @transfer-item="handleTransferItem"
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
      @return-to-map="handleReturnToMap" />

    <InstructionCardView
      v-else-if="gameState.playMode && !gameFailed && activeView.kind === 'document'"
      :documents="characterDocuments"
      :payload="activeView.payload"
      @return-to-map="handleReturnToMap" />

    <StoryOverlay
      v-if="gameState.playMode && !gameFailed && isMapView"
      :completion="pendingCompletion"
      @dismiss-completion="dismissCompletion" />
  </main>
</template>

<style scoped>
.mode-choice {
  min-height: min(58vh, 32rem);
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
}
.mode-choice-panel {
  width: min(46rem, 100%);
  border: 1px solid #566174;
  background: #1f2631;
  border-radius: 8px;
  padding: 1.25rem;
}
.mode-choice-kicker {
  margin: 0 0 0.25rem;
  color: #9fb0c2;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
.mode-choice-panel h2 {
  margin: 0 0 1rem;
  font-size: 1.35rem;
}
.mode-choice-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.75rem;
}
.mode-choice-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
  min-height: 8.5rem;
  border: 1px solid #566174;
  border-radius: 8px;
  background: #293241;
  color: #eef3f8;
  padding: 1rem;
}
.mode-choice-card.recommended {
  border-color: #7ea77e;
  background: #26362d;
}
.mode-choice-label {
  font-size: 1rem;
  font-weight: 700;
}
.mode-choice-note {
  color: #c2ccd8;
  font-size: 0.9rem;
  line-height: 1.4;
}
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
</style>
