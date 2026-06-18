<script setup>
import { ref, onMounted, computed } from "vue";
import { RouterLink } from "vue-router";
import mapData from "../../content/world/map.yaml";
import buildingData from "../../content/world/utility-station.yaml";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { useIndoorBuilding } from "../lib/maps/composables/useIndoorBuilding.js";
import { createGameState, resetGameState } from "../composables/useGameState.js";
import { useSaveGame } from "../composables/useSaveGame.js";
import { useStory } from "../composables/useStory.js";
import { useStoryContent } from "../composables/useStoryContent.js";
import AppHeader from "../components/AppHeader.vue";
import StoryOverlay from "../components/story/StoryOverlay.vue";
import OutdoorScene from "../lib/maps/views/OutdoorScene.vue";
import IndoorScene from "../lib/maps/views/IndoorScene.vue";

const place = ref("outdoors");
const builderView = ref(false);
const movementAuditVisible = ref(false);
const { storyData, error: contentError, refresh: refreshContent } = useStoryContent();

const gameState = createGameState({ mapData, buildingData });
const outdoor = useOutdoorWorld(mapData, gameState);
const ctx = { place, builderView, gameState };
const indoor = useIndoorBuilding(buildingData, outdoor, ctx);
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
} = useStory(storyData, { gameState, place, outdoor, indoor });

const saveCtx = computed(() => ({ gameState, place, outdoor, indoor }));

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
  resetGameState(saveCtx.value);
  refreshNarrative();
}
</script>

<template>
  <main class="game-shell">
    <nav class="view-nav"><RouterLink to="/builder">Open story builder</RouterLink></nav>
    <AppHeader
      :has-save="hasSave()"
      :last-saved-at="lastSavedAt"
      :load-error="loadError"
      :movement-audit-visible="movementAuditVisible"
      @save="saveGame(saveCtx)"
      @new-game="handleNewGame"
      @reset="handleReset"
      @show-movement-audit="movementAuditVisible = true" />

    <div v-if="contentError" class="content-error">
      {{ contentError }}
      <button class="sm" @click="refreshContent()">Retry</button>
    </div>

    <OutdoorScene
      v-if="place === 'outdoors'"
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
      v-else
      :indoor="indoor"
      :narrative-beat="narrativeBeat"
      :pending-beat="pendingBeat"
      :apply-choice="applyChoice"
      :travel-to-room="travelToRoom" />

    <StoryOverlay :show-end-card="showEndCard" @dismiss-end="dismissEndCard" />
  </main>
</template>
