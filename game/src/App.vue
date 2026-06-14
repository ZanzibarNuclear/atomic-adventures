<script setup>
import { ref, onMounted, computed } from "vue";
import mapData from "../content/world/map.yaml";
import buildingData from "../content/world/utility-station.yaml";
import storyData from "../content/story/part-i.yaml";
import { useOutdoorWorld } from "./lib/maps/composables/useOutdoorWorld.js";
import { useIndoorBuilding } from "./lib/maps/composables/useIndoorBuilding.js";
import { createGameState, resetGameState } from "./composables/useGameState.js";
import { useSaveGame } from "./composables/useSaveGame.js";
import { useStory } from "./composables/useStory.js";
import AppHeader from "./components/AppHeader.vue";
import StoryOverlay from "./components/story/StoryOverlay.vue";
import OutdoorScene from "./lib/maps/views/OutdoorScene.vue";
import IndoorScene from "./lib/maps/views/IndoorScene.vue";

const place = ref("outdoors");
const builderView = ref(false);

const gameState = createGameState({ mapData, buildingData });
const outdoor = useOutdoorWorld(mapData);
outdoor.mode = "explored";
const ctx = { place, builderView, gameState };
const indoor = useIndoorBuilding(buildingData, outdoor, ctx);
const save = useSaveGame();
const { lastSavedAt, loadError, hasSave, save: saveGame, load, clearSave } = save;

const storyCtx = { gameState, place, outdoor, indoor };
const {
  activeBeat,
  showEndCard,
  dismissBeat,
  dismissEndCard,
  tryShowBeat,
} = useStory(storyData, storyCtx);

const saveCtx = computed(() => ({
  gameState,
  place,
  outdoor,
  indoor,
}));

onMounted(() => {
  if (hasSave()) {
    load(saveCtx.value);
  }
  tryShowBeat();
});

function handleSave() {
  saveGame(saveCtx.value);
}

function handleNewGame() {
  if (
    hasSave() &&
    !window.confirm("Start a new game? Your saved progress will be erased.")
  ) {
    return;
  }
  clearSave();
  resetGameState(saveCtx.value);
  tryShowBeat();
}

function handleReset() {
  resetGameState(saveCtx.value);
  tryShowBeat();
}
</script>

<template>
  <main>
    <AppHeader
      :has-save="hasSave()"
      :last-saved-at="lastSavedAt"
      :load-error="loadError"
      @save="handleSave"
      @new-game="handleNewGame"
      @reset="handleReset" />

    <OutdoorScene
      v-if="place === 'outdoors'"
      :outdoor="outdoor"
      :indoor="indoor" />

    <IndoorScene v-else :indoor="indoor" />

    <StoryOverlay
      :beat="activeBeat"
      :show-end-card="showEndCard"
      @choose="dismissBeat"
      @dismiss-end="dismissEndCard" />
  </main>
</template>

<style scoped>
main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
</style>
