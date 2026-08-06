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
              <button
                type="button"
                class="dev-menu-item"
                @click="showDevSettings">
                Settings
              </button>
            </div>
          </details>
          <button
            v-if="playMode"
            type="button"
            class="sm player-health"
            @click="$emit('show-health')">
            Health
          </button>
          <button
            v-if="playMode"
            type="button"
            class="sm player-inventory"
            @click="$emit('show-inventory')">
            Inventory
          </button>
          <details v-if="playMode" ref="gameMenu" class="game-menu">
            <summary class="sm">Game</summary>
            <div class="game-menu-popover">
              <p v-if="playModeLabel" class="menu-label mode-menu-label">
                {{ playModeLabel }}
              </p>

              <div class="save-toolbar">
                <button type="button" class="toolbar-btn success" @click="handleSave">
                  <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M5 4h11l3 3v13H5V4z"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linejoin="round" />
                    <path
                      d="M8 4v5h8V4M8 20v-7h8v7"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linejoin="round" />
                  </svg>
                  Save
                </button>
                <button type="button" class="toolbar-btn" @click="handleNewGame">
                  <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 5v14M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round" />
                  </svg>
                  New Game
                </button>
              </div>

              <div
                v-for="slot in slots"
                :key="`game-${slot.id}`"
                class="game-row"
                :class="{ active: slot.active }">
                <div class="game-row-main">
                  <span class="game-name">Game {{ slot.id }}</span>
                  <div class="game-row-actions">
                    <button
                      type="button"
                      class="row-btn play"
                      @click="handlePlay(slot.id)">
                      <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5.5v13l11-6.5L8 5.5z" fill="currentColor" />
                      </svg>
                      Play
                    </button>
                    <button
                      v-if="slot.occupied"
                      type="button"
                      class="row-btn restart"
                      @click="handleRestart(slot.id)">
                      <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4M19.5 12a7.5 7.5 0 0 1-12.7 5.4"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.9"
                          stroke-linecap="round" />
                        <path
                          d="M17 3.8v4.2h-4.2M7 20.2v-4.2h4.2"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.9"
                          stroke-linecap="round"
                          stroke-linejoin="round" />
                      </svg>
                      Restart
                    </button>
                  </div>
                </div>
                <p class="game-status">{{ gameStatusLine(slot) }}</p>
              </div>

              <button type="button" class="menu-item credits-item" @click="showCredits">
                Credits | Terms of Use
              </button>
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
  activeSlot: { type: Number, default: 1 },
  slots: { type: Array, default: () => [] },
  lastSavedAt: { type: String, default: null },
  loadError: { type: String, default: null },
  movementAuditVisible: { type: Boolean, default: false },
  playMode: { type: String, default: null },
});

const emit = defineEmits([
  "save",
  "play-game",
  "restart-game",
  "new-game",
  "show-dev-settings",
  "show-movement-audit",
  "show-health",
  "show-inventory",
]);
const devMode = import.meta.env.DEV;
const devMenu = ref(null);
const gameMenu = ref(null);
const creditsOpen = ref(false);

const playModeLabel = computed(() => {
  if (props.playMode === "story") return "Story mode";
  if (props.playMode === "open-world") return "Open-world mode";
  return "";
});

/** e.g. "August 6, 2026, at 9:06 AM" — same as the Welcome Back modal. */
function formatSavedAt(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart}, at ${timePart}`;
}

/** Status line under each game row: active | saved | open (+ time when useful). */
function gameStatusLine(slot) {
  const when = formatSavedAt(slot.savedAt);
  if (slot.active) {
    if (slot.occupied && when) return `active · ${when}`;
    if (slot.occupied) return "active · saved";
    return "active · open";
  }
  if (slot.occupied) return when ? `saved · ${when}` : "saved";
  return "open";
}

function showMovementAudit() {
  emit("show-movement-audit");
  if (devMenu.value) devMenu.value.open = false;
}

function showDevSettings() {
  emit("show-dev-settings");
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

function handlePlay(gameId) {
  emit("play-game", gameId);
  closeGameMenu();
}

function handleRestart(gameId) {
  emit("restart-game", gameId);
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
  background: linear-gradient(105deg, #e8eaed 0%, #e8eaed 42%, var(--color-cherenkov) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
@supports not (background-clip: text) {
  .title-block h1 {
    color: var(--color-text);
    background: none;
  }
}
.sub {
  color: var(--color-text-muted);
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
  color: var(--color-cherenkov);
}
.dev-menu[open] summary,
.game-menu[open] summary {
  background: #3a4555;
  border-color: var(--color-brand-border);
  color: #eef3f8;
  box-shadow: 0 0 0 1px var(--color-cherenkov-soft);
}
.dev-menu-popover,
.game-menu-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.35rem);
  right: 0;
  min-width: 16.5rem;
  padding: 0.4rem 0.4rem 0.45rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  background: var(--color-bg-elevated);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.35),
    0 0 0 1px var(--color-cherenkov-soft);
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
.menu-label {
  margin: -0.15rem 0 0.25rem;
  padding: 0 0.55rem 0.35rem;
  border-bottom: 1px solid #343e50;
  color: #8f98a8;
  font-size: 0.76rem;
  line-height: 1.35;
  white-space: nowrap;
}
.mode-menu-label {
  color: #c7d4e2;
  margin-bottom: 0.35rem;
}
.save-toolbar {
  display: flex;
  gap: 0.4rem;
  padding: 0.15rem 0.25rem 0.55rem;
}
.toolbar-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid #556176;
  border-radius: 7px;
  background: #303846;
  color: #d5dce6;
  padding: 0.4rem 0.5rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}
.toolbar-btn.success {
  background: color-mix(in srgb, var(--color-cherenkov) 22%, #1a2830);
  border-color: var(--color-brand-border, rgba(32, 200, 251, 0.45));
  color: #e8f9ff;
}
.toolbar-btn:hover {
  filter: brightness(1.08);
}
.btn-icon {
  width: 0.95em;
  height: 0.95em;
  flex-shrink: 0;
  display: block;
}
.game-row {
  padding: 0.4rem 0.45rem 0.45rem;
  border-top: 1px solid #343e50;
}
.game-row.active {
  background: color-mix(in srgb, var(--color-cherenkov) 8%, transparent);
  border-radius: 6px;
}
.game-row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.game-name {
  font-weight: 800;
  color: #d5dce6;
  font-size: 0.9rem;
}
.game-row.active .game-name {
  color: var(--color-cherenkov-bright, #5ad8fc);
}
.game-row-actions {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}
.row-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  border: 1px solid #556176;
  border-radius: 6px;
  background: #2a3140;
  color: #d5dce6;
  padding: 0.28rem 0.5rem;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
}
.row-btn .btn-icon {
  width: 0.9em;
  height: 0.9em;
}
.row-btn.play {
  border-color: var(--color-brand-border, rgba(32, 200, 251, 0.4));
  color: #e8f9ff;
}
.row-btn.restart {
  color: #ffb38a;
  border-color: #6a4a40;
}
.row-btn:hover {
  filter: brightness(1.1);
}
.game-status {
  margin: 0.28rem 0 0;
  padding: 0;
  color: #8f98a8;
  font-size: 0.74rem;
  line-height: 1.3;
}
.game-row.active .game-status {
  color: var(--color-cherenkov-muted, rgba(32, 200, 251, 0.72));
}
.credits-item {
  margin-top: 0.25rem;
  border-top: 1px solid #343e50;
  padding-top: 0.5rem;
}
.dev-menu-item:hover:not(:disabled),
.menu-item:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-cherenkov) 12%, #344158);
}
.error-hint {
  margin: 0;
  font-size: 0.82rem;
  color: #e07a7a;
  text-align: right;
}
</style>
