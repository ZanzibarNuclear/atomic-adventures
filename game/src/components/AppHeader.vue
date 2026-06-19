<template>
  <header>
    <div class="header-row">
      <div class="title-block">
        <h1>Atomic Adventures</h1>
        <p class="sub">Part I — Zanzibar's World of Energy</p>
      </div>
      <div class="controls-column">
        <div class="game-controls">
          <button
            type="button"
            class="sm view-toggle"
            :aria-pressed="activeGameView === 'character'"
            @click="$emit(activeGameView === 'character' ? 'show-map' : 'show-character')">
            {{ activeGameView === "character" ? "Map" : "Character" }}
          </button>
          <details v-if="devMode" ref="devMenu" class="dev-menu">
            <summary class="sm">Developer</summary>
            <div class="dev-menu-popover">
              <button
                type="button"
                class="dev-menu-item"
                @click="openStoryBuilder">
                Open story builder
              </button>
              <button
                type="button"
                class="dev-menu-item"
                :disabled="movementAuditVisible"
                @click="showMovementAudit">
                {{ movementAuditVisible ? "Movement audit shown" : "Show movement audit" }}
              </button>
            </div>
          </details>
          <button class="sm" @click="$emit('save')">Save</button>
          <button v-if="hasSave" class="sm muted" @click="$emit('new-game')">
            New game
          </button>
          <button class="sm muted" @click="$emit('reset')">Reset</button>
        </div>
        <p v-if="showSaveHint" class="save-hint">
          Last saved {{ formattedSavedAt }}
        </p>
        <p v-if="loadError" class="error-hint">{{ loadError }}</p>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, ref } from "vue";

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

function openStoryBuilder() {
  window.open(
    "/builder/story",
    "atomic-adventures-story-builder",
    "popup=yes,width=1500,height=900",
  );
  if (devMenu.value) devMenu.value.open = false;
}
</script>

<style scoped>
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
.dev-menu {
  position: relative;
}
.dev-menu summary {
  list-style: none;
  user-select: none;
  background: #252a33;
  color: #9aa0ac;
  border: 1px solid #3a404a;
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.82rem;
  cursor: pointer;
}
.dev-menu summary::-webkit-details-marker {
  display: none;
}
.dev-menu summary::after {
  content: " ▾";
}
.dev-menu[open] summary {
  background: #323945;
  color: #d5d9df;
}
.dev-menu-popover {
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
.dev-menu-item {
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0.45rem 0.55rem;
  text-align: left;
  white-space: nowrap;
}
.dev-menu-item:hover:not(:disabled) {
  background: #344158;
}
.save-hint {
  margin: 0;
  font-size: 0.78rem;
  color: #6f7787;
  text-align: right;
}
.error-hint {
  margin: 0;
  font-size: 0.82rem;
  color: #e07a7a;
  text-align: right;
}
</style>
