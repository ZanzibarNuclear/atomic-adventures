<template>
  <header>
    <div class="header-row">
      <div class="title-block">
        <h1>Zanzibar's World of Energy</h1>
      </div>
      <div class="controls-column">
        <div class="game-controls">
          <details v-if="devMode" ref="devMenu" class="dev-menu">
            <summary class="sm">Dev Tools</summary>
            <div class="dev-menu-popover">
              <a
                href="/builder/story"
                target="_blank"
                rel="noopener"
                class="dev-menu-item"
                @click="closeDevMenu">
                Open story builder
              </a>
              <button
                type="button"
                class="dev-menu-item"
                :disabled="movementAuditVisible"
                @click="showMovementAudit">
                {{ movementAuditVisible ? "Movement audit shown" : "Show movement audit" }}
              </button>
            </div>
          </details>
          <button
            type="button"
            class="sm view-toggle"
            :aria-pressed="activeGameView === 'character'"
            @click="$emit(activeGameView === 'character' ? 'show-map' : 'show-character')">
            {{ activeGameView === "character" ? "Map" : "Player Stats" }}
          </button>
          <details ref="gameMenu" class="game-menu">
            <summary class="sm">Game</summary>
            <div class="game-menu-popover">
              <button type="button" class="menu-item success" @click="handleSave">Save</button>
              <p v-if="showSaveHint" class="menu-label">
                Last saved {{ formattedSavedAt }}
              </p>
              <button type="button" class="menu-item warning" @click="handleReset">Reset</button>
              <button v-if="hasSave" type="button" class="menu-item muted" @click="handleNewGame">
                New game
              </button>
              <button type="button" class="menu-item" @click="showCredits">Credits</button>
            </div>
          </details>
        </div>
        <p v-if="loadError" class="error-hint">{{ loadError }}</p>
      </div>
    </div>
    <CreditsDialog
      v-if="creditsOpen"
      @close="creditsOpen = false" />
  </header>
</template>

<script setup>
import { computed, ref } from "vue";
import CreditsDialog from "./CreditsDialog.vue";

const props = defineProps({
  hasSave: { type: Boolean, default: false },
  lastSavedAt: { type: String, default: null },
  loadError: { type: String, default: null },
  movementAuditVisible: { type: Boolean, default: false },
  activeGameView: { type: String, default: "map" },
});

const emit = defineEmits([
  "save",
  "new-game",
  "reset",
  "show-movement-audit",
  "show-character",
  "show-map",
]);
const devMode = import.meta.env.DEV;
const devMenu = ref(null);
const gameMenu = ref(null);
const creditsOpen = ref(false);

const formattedSavedAt = computed(() => {
  const raw = props.lastSavedAt;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
});

const showSaveHint = computed(() => formattedSavedAt.value.length > 0);

function showMovementAudit() {
  emit("show-movement-audit");
  if (devMenu.value) devMenu.value.open = false;
}

function closeDevMenu() {
  if (devMenu.value) devMenu.value.open = false;
}

function closeGameMenu() {
  if (gameMenu.value) gameMenu.value.open = false;
}

function handleSave() {
  emit("save");
  closeGameMenu();
}

function handleReset() {
  emit("reset");
  closeGameMenu();
}

function handleNewGame() {
  emit("new-game");
  closeGameMenu();
}

function showCredits() {
  creditsOpen.value = true;
  closeGameMenu();
}
</script>

<style scoped>
header {
  margin-bottom: 0.75rem;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}
.title-block h1 {
  font-size: 1.4rem;
  margin: 0 0 0.25rem;
}
.sub {
  color: #9aa0ac;
  margin: 0;
  font-size: 0.92rem;
}
.controls-column {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
}
.game-controls {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.view-toggle[aria-pressed="true"] {
  background: #49624f;
  border-color: #6f9b79;
}
.dev-menu,
.game-menu {
  position: relative;
}
.dev-menu summary,
.game-menu summary {
  list-style: none;
  user-select: none;
  background: #303846;
  color: #d5dce6;
  border: 1px solid #556176;
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.dev-menu summary::-webkit-details-marker,
.game-menu summary::-webkit-details-marker {
  display: none;
}
.dev-menu summary::after,
.game-menu summary::after {
  content: " ▾";
  color: #9fc7ff;
}
.dev-menu[open] summary,
.game-menu[open] summary {
  background: #3a4555;
  border-color: #6c7b95;
  color: #eef3f8;
}
.dev-menu-popover,
.game-menu-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 12rem;
  padding: 0.35rem;
  border: 1px solid #465166;
  border-radius: 8px;
  background: #202630;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}
.dev-menu-item,
.menu-item {
  display: block;
  box-sizing: border-box;
  width: 100%;
  border: 0;
  background: transparent;
  color: #d5dce6;
  padding: 0.45rem 0.55rem;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  font: inherit;
  cursor: pointer;
}
.menu-item.muted {
  color: #aab0bc;
}
.menu-item.success {
  color: #9fdbad;
}
.menu-item.warning {
  color: #ffb38a;
}
.menu-label {
  margin: -0.15rem 0 0.25rem;
  padding: 0 0.55rem 0.35rem;
  border-bottom: 1px solid #343e50;
  color: #8f98a8;
  font-size: 0.76rem;
  line-height: 1.35;
  white-space: nowrap;
}
.dev-menu-item:hover:not(:disabled),
.menu-item:hover:not(:disabled) {
  background: #344158;
}
.menu-item.success:hover:not(:disabled) {
  background: #294333;
}
.menu-item.warning:hover:not(:disabled) {
  background: #4a3028;
}
.error-hint {
  margin: 0;
  font-size: 0.82rem;
  color: #e07a7a;
  text-align: right;
}
</style>
