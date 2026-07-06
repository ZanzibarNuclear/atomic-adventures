<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { useIndoorBuilding } from "../lib/maps/composables/useIndoorBuilding.js";
import { createGameState, resetGameState, setPlayMode } from "../composables/useGameState.js";
import { useSaveGame } from "../composables/useSaveGame.js";
import { useStory } from "../composables/useStory.js";
import { useStoryline } from "../composables/useStoryline.js";
import { useStoryContent } from "../composables/useStoryContent.js";
import { useWorldContent } from "../composables/useWorldContent.js";
import { useBuildingContent } from "../composables/useBuildingContent.js";
import { useGameView } from "../composables/useGameView.js";
import { useCharacterContent } from "../composables/useCharacterContent.js";
import { useLearningContent } from "../composables/useLearningContent.js";
import { useStorylineContent } from "../composables/useStorylineContent.js";
import {
  isActionAllowed,
  isStageViewAllowed,
} from "../composables/useStoryline.js";
import {
  markCharacterChanged,
  syncCharacterDefinitions,
  syncCharacterHolderDefinitions,
} from "../composables/useCharacterState.js";
import { applyOutdoorWorldUpdate } from "../composables/worldRuntime.js";
import { performItemAction } from "../lib/character/itemActions.js";
import {
  accessibleHolderIds,
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
import InventoryStageView from "../components/game-views/InventoryStageView.vue";
import StoryOverlay from "../components/story/StoryOverlay.vue";
import OutdoorScene from "../lib/maps/views/OutdoorScene.vue";
import IndoorScene from "../lib/maps/views/IndoorScene.vue";
import {
  characterWellbeingOverview,
  visibleCharacterStats,
} from "../lib/character/panel.js";
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
  storylineData,
  error: storylineContentError,
  refresh: refreshStoryline,
} = useStorylineContent();
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
const {
  activeStep: activeStorylineStep,
  currentObjective,
  authoringError: storylineError,
  actionPolicy: storylineActionPolicy,
  tick: tickStoryline,
} = useStoryline(storylineData, { gameState, place, outdoor, indoor, openStageView: openStageViewForStory });
const {
  narrativeBeat,
  pendingBeat,
  showEndCard,
  applyChoice,
  travelToHex,
  enterBuilding,
  travelToRoom,
  dismissEndCard,
  refreshNarrative,
} = useStory(storyData, {
  gameState,
  place,
  outdoor,
  indoor,
  openStageView: openStageViewForStory,
  storylineStep: activeStorylineStep,
});

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
const inventoryHolders = computed(() => {
  const ids = [...accessibleHolderIds(
    gameState.character.holdings,
    "nearby",
    [...nearbyHolderIds.value, currentWorldHolderId()],
  )];
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
      relatedDocument: record.definition?.relatedDocument ?? null,
    })),
  }));
});
const transferTargets = computed(() => inventoryHolders.value
  .filter((holder) => holder.kind !== "container")
  .map((holder) => ({
    id: holder.id,
    label: holder.label ?? holder.id,
    kind: holder.kind,
  })));
const stageSelectedHolding = computed(() =>
  inventoryHolders.value.flatMap((holder) =>
    holder.records.map((record) => ({ ...record, holder })))
    .find((record) => `${record.type}:${record.id}` === stageSelectedHoldingId.value) ?? null,
);
const characterStats = computed(() => visibleCharacterStats(gameState.character));
const wellbeingOverview = computed(() => characterWellbeingOverview(gameState.character));
const wellbeingAlerts = computed(() =>
  wellbeingOverview.value.vitals
    .filter((vital) => vital.tone === "warning" || vital.tone === "error")
    .map((vital) => ({
      id: vital.id,
      label: vital.label,
      state: vital.state,
      tone: vital.tone,
    })),
);
const catastrophicVitals = computed(() =>
  wellbeingOverview.value.vitals.filter((vital) =>
    vital.tone === "error" && Number(vital.value) <= Number(vital.min ?? 0),
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
const defaultScenario = computed(() =>
  storylineData.value?.scenarios?.find((scenario) => scenario.defaultMode === "story") ??
  storylineData.value?.scenarios?.[0] ??
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
  refreshNarrative();
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
  refreshNarrative();
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

onMounted(async () => {
  if (hasSave()) load(saveCtx.value);
  await refreshContent();
  tickStoryline();
  refreshNarrative();
});

watch(storylineData, () => {
  tickStoryline();
});

function handleNewGame() {
  if (hasSave() && !window.confirm("Start a new game? Your saved progress will be erased.")) return;
  clearSave();
  resetGameState(saveCtx.value);
  refreshNarrative();
}

function handleReset() {
  if (!hasSave() || !load(saveCtx.value)) resetGameState(saveCtx.value);
  tickStoryline();
  refreshNarrative();
}

function choosePlayMode(mode) {
  if (mode === "story") {
    const scenario = defaultScenario.value;
    const startStep = scenario?.steps?.find((step) => step.id === scenario.startStep);
    setPlayMode(gameState, "story", {
      scenarioId: scenario?.id,
      stepId: scenario?.startStep ?? null,
      objective: startStep?.objective ?? null,
    });
  } else {
    setPlayMode(gameState, "open-world");
  }
  tickStoryline();
  refreshNarrative();
}

function handleReturnToMap() {
  returnToMap();
  lessonCompletionError.value = "";
  nextTick(() => document.querySelector(".view-toggle")?.focus());
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

function handleOpenCharacter() {
  currentWorldHolderId();
  openCharacter();
}

function publicAssetPath(path) {
  if (!path) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }
  return path.startsWith("/") ? path : `/${path.replace(/^\.?\//, "")}`;
}

function openStageView(view, { force = false } = {}) {
  const kind = view?.kind;
  if (!kind) return false;
  if (!force && !isStageViewAllowed(storylineActionPolicy.value, view)) return false;
  if (kind === "inventory") {
    currentWorldHolderId();
    return openCharacter({ ...view, tab: "inventory" });
  }
  if (kind === "character-stats") return openCharacterStats(view);
  if (kind === "character") return openCharacter(view);
  return openView(kind, view);
}

function handleHoloReaderAction(id) {
  if (!isActionAllowed(id, storylineActionPolicy.value)) return;
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
  if (!isStageViewAllowed(storylineActionPolicy.value, {
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
  if (!isStageViewAllowed(storylineActionPolicy.value, {
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
  if (result.ok) refreshNarrative();
}

function handleUseItem({ itemId, actionId }) {
  if (!isActionAllowed(`item-action:${itemId}.${actionId}`, storylineActionPolicy.value, {
    itemId,
    actionId,
  })) return;
  const result = performItemAction(gameState, itemId, actionId);
  if (result.ok) {
    refreshNarrative();
    if (result.view) openStageView(result.view);
  }
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
    refreshNarrative();
  } catch (error) {
    console.warn(error);
  }
}
</script>

<template>
  <main class="game-shell">
    <AppHeader
      :has-save="hasSave()"
      :last-saved-at="lastSavedAt"
      :load-error="loadError"
      :movement-audit-visible="movementAuditVisible"
      :active-game-view="activeView.kind"
      :play-mode="gameState.playMode"
      @save="saveGame(saveCtx)"
      @new-game="handleNewGame"
      @reset="handleReset"
      @show-character="handleOpenCharacter"
      @show-map="returnToMap"
      @show-dev-settings="developerSettingsVisible = true"
      @show-movement-audit="movementAuditVisible = true" />

    <DeveloperSettingsDialog
      v-if="developerSettingsVisible"
      :station-power-on="stationPowerOverrideOn"
      @set-station-power="handleSetStationPowerOverride"
      @close="developerSettingsVisible = false" />

    <div
      v-if="contentError || worldContentError || buildingContentError || characterContentError || learningContentError || storylineContentError"
      class="content-error">
      {{ contentError || worldContentError || buildingContentError || characterContentError || learningContentError || storylineContentError }}
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
                  : refreshStoryline()"
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
      v-else-if="gameState.playMode === 'story' && currentObjective"
      class="story-objective"
      aria-label="Current objective">
      <span class="story-objective-label">Objective</span>
      <span>{{ currentObjective }}</span>
    </section>

    <section
      v-if="storylineError"
      class="storyline-error"
      role="alert">
      {{ storylineError }}
    </section>

    <section
      v-if="wellbeingAlerts.length && !gameFailed"
      class="wellbeing-alerts"
      role="status"
      aria-label="Wellbeing warnings">
      <span class="wellbeing-alerts-label">Vitals</span>
      <span
        v-for="alert in wellbeingAlerts"
        :key="alert.id"
        class="wellbeing-chip"
        :class="alert.tone">
        {{ alert.label }}: {{ alert.state }}
      </span>
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
      :action-policy="storylineActionPolicy"
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
      :action-policy="storylineActionPolicy"
      @extra-action="handleHoloReaderAction"
      @stage-view="openStageView"
      @hide-movement-audit="movementAuditVisible = false" />

    <InventoryStageView
      v-else-if="gameState.playMode && !gameFailed && activeView.kind === 'inventory'"
      :holders="inventoryHolders"
      :selected-holding="stageSelectedHolding"
      :selected-holding-id="stageSelectedHoldingId"
      :transfer-targets="transferTargets"
      :public-asset-path="publicAssetPath"
      :action-policy="storylineActionPolicy"
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
      :action-policy="storylineActionPolicy"
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
      :show-end-card="showEndCard"
      @dismiss-end="dismissEndCard" />
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
.story-objective {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
  border: 1px solid #4f6174;
  background: #202b37;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.75rem;
  color: #e9f0f8;
}
.story-objective-label {
  color: #9fb0c2;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
.storyline-error {
  border: 1px solid #9f6a5d;
  background: #39251f;
  color: #ffd6cd;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.75rem;
}
.wellbeing-alerts {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  border: 1px solid #756143;
  background: #2f281e;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  margin-bottom: 0.75rem;
}
.wellbeing-alerts-label,
.failure-kicker {
  color: #d7b77f;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
.wellbeing-chip {
  border: 1px solid #675640;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  color: #ffdca3;
  font-size: 0.82rem;
}
.wellbeing-chip.error {
  border-color: #8d4c4c;
  color: #ffabab;
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
