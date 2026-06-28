<script setup>
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { useIndoorBuilding } from "../lib/maps/composables/useIndoorBuilding.js";
import { createGameState, resetGameState } from "../composables/useGameState.js";
import { useSaveGame } from "../composables/useSaveGame.js";
import { useStory } from "../composables/useStory.js";
import { useStoryContent } from "../composables/useStoryContent.js";
import { useWorldContent } from "../composables/useWorldContent.js";
import { useBuildingContent } from "../composables/useBuildingContent.js";
import { useGameView } from "../composables/useGameView.js";
import { useCharacterContent } from "../composables/useCharacterContent.js";
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
import InventoryStageView from "../components/game-views/InventoryStageView.vue";
import StoryOverlay from "../components/story/StoryOverlay.vue";
import OutdoorScene from "../lib/maps/views/OutdoorScene.vue";
import IndoorScene from "../lib/maps/views/IndoorScene.vue";
import { visibleCharacterStats } from "../lib/character/panel.js";

const place = ref("outdoors");
const builderView = ref(false);
const movementAuditVisible = ref(false);
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
} = useStory(storyData, { gameState, place, outdoor, indoor, openStageView });

const saveCtx = computed(() => ({ gameState, place, outdoor, indoor }));
const nearbyHolderIds = computed(() => {
  const ids = [];
  for (const holder of Object.values(gameState.character.holdings.holders ?? {})) {
    if (holder.kind === "vehicle" || holder.kind === "fixed") {
      const location = holder.location ?? {};
      if (place.value === "indoors" && location.room && location.room === indoor.indoor.currentRoom) {
        ids.push(holder.id);
      }
      if (
        place.value === "indoors" &&
        location.exteriorNode &&
        location.exteriorNode === indoor.indoor.exteriorNode
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
  refreshNarrative();
});

function handleNewGame() {
  if (hasSave() && !window.confirm("Start a new game? Your saved progress will be erased.")) return;
  clearSave();
  resetGameState(saveCtx.value);
  refreshNarrative();
}

function handleReset() {
  if (!hasSave() || !load(saveCtx.value)) resetGameState(saveCtx.value);
  refreshNarrative();
}

function handleReturnToMap() {
  returnToMap();
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

function openStageView(view) {
  const kind = view?.kind;
  if (!kind) return false;
  if (kind === "inventory") {
    currentWorldHolderId();
    return openCharacter({ ...view, tab: "inventory" });
  }
  if (kind === "character-stats") return openCharacterStats(view);
  if (kind === "character") return openCharacter(view);
  return openView(kind, view);
}

function handleUseItem({ itemId, actionId }) {
  const result = performItemAction(gameState, itemId, actionId);
  if (result.ok) refreshNarrative();
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
      @save="saveGame(saveCtx)"
      @new-game="handleNewGame"
      @reset="handleReset"
      @show-character="handleOpenCharacter"
      @show-map="returnToMap"
      @show-movement-audit="movementAuditVisible = true" />

    <div
      v-if="contentError || worldContentError || buildingContentError || characterContentError"
      class="content-error">
      {{ contentError || worldContentError || buildingContentError || characterContentError }}
      <button
        class="sm"
        @click="contentError
          ? refreshContent()
          : worldContentError
            ? refreshWorld()
            : buildingContentError
              ? refreshBuilding()
              : refreshCharacter()"
      >Retry</button>
    </div>

    <OutdoorScene
      v-if="isMapView && place === 'outdoors'"
      :outdoor="outdoor"
      :indoor="indoor"
      :narrative-beat="narrativeBeat"
      :pending-beat="pendingBeat"
      :apply-choice="applyChoice"
      :travel-to-hex="travelToHex"
      :enter-building="enterBuilding"
      :audit-enabled="movementAuditVisible"
      @hide-movement-audit="movementAuditVisible = false" />

    <IndoorScene
      v-else-if="isMapView"
      :indoor="indoor"
      :narrative-beat="narrativeBeat"
      :pending-beat="pendingBeat"
      :apply-choice="applyChoice"
      :travel-to-room="travelToRoom"
      :audit-enabled="movementAuditVisible"
      @hide-movement-audit="movementAuditVisible = false" />

    <InventoryStageView
      v-else-if="activeView.kind === 'inventory'"
      :holders="inventoryHolders"
      :selected-holding="stageSelectedHolding"
      :selected-holding-id="stageSelectedHoldingId"
      :transfer-targets="transferTargets"
      :public-asset-path="publicAssetPath"
      @select-holding="stageSelectedHoldingId = $event"
      @use-item="handleUseItem"
      @transfer-item="handleTransferItem"
      @return-to-map="handleReturnToMap" />

    <CharacterStatsStageView
      v-else-if="activeView.kind === 'character-stats'"
      :stats="characterStats"
      :focus="activeView.payload?.focus"
      @return-to-map="handleReturnToMap" />

    <CharacterView
      v-else-if="isCharacterView"
      :character="gameState.character"
      :clock="gameState.clock"
      :nearby-holder-ids="[...nearbyHolderIds, currentWorldHolderId()]"
      :initial-tab="activeView.payload?.tab"
      @use-item="handleUseItem"
      @transfer-item="handleTransferItem"
      @return-to-map="handleReturnToMap" />

    <StoryOverlay
      v-if="isMapView"
      :show-end-card="showEndCard"
      @dismiss-end="dismissEndCard" />
  </main>
</template>
