<template>
  <div
    class="modal-backdrop"
    role="presentation"
    @click.self="emitCancel">
    <section
      class="save-dialog"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h2 :id="titleId">{{ title }}</h2>
      <p class="message">{{ message }}</p>

      <div v-if="showGameChoices" class="game-choices">
        <button
          v-for="slot in slots"
          :key="slot.id"
          type="button"
          class="game-choice"
          :class="{ occupied: slot.occupied }"
          @click="$emit('choose-game', slot.id)">
          <span class="game-choice-name">Game {{ slot.id }}</span>
          <span class="game-choice-meta">{{ choiceMeta(slot) }}</span>
        </button>
      </div>

      <div class="actions">
        <button
          v-if="showSave"
          type="button"
          class="primary"
          @click="$emit('save')">
          Save and continue
        </button>
        <button
          v-if="showDiscard"
          type="button"
          class="danger-outline"
          @click="$emit('discard')">
          {{ discardLabel }}
        </button>
        <button type="button" class="muted" @click="emitCancel">
          Cancel
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  mode: {
    type: String,
    required: true,
    // save-before-switch | pick-game
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  eyebrow: { type: String, default: "Save" },
  discardLabel: { type: String, default: "Don't save" },
  slots: { type: Array, default: () => [] },
  activeGame: { type: Number, default: 1 },
});

const emit = defineEmits(["save", "discard", "cancel", "choose-game"]);

const titleId = computed(() => `save-dialog-title-${props.mode}`);
const showSave = computed(() => props.mode === "save-before-switch");
const showDiscard = computed(() => props.mode === "save-before-switch");
const showGameChoices = computed(() => props.mode === "pick-game");

function formatSavedAt(raw) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function choiceMeta(slot) {
  if (slot.id === props.activeGame && slot.occupied) {
    return `active · ${formatSavedAt(slot.savedAt) || "saved"}`;
  }
  if (slot.id === props.activeGame) return "active";
  if (slot.occupied) return formatSavedAt(slot.savedAt) || "saved";
  return "open";
}

function emitCancel() {
  emit("cancel");
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(10, 12, 16, 0.68);
}

.save-dialog {
  width: min(100%, 24rem);
  border: 1px solid var(--color-border-strong, #465166);
  border-radius: 8px;
  background: var(--color-bg-elevated, #202630);
  box-shadow:
    0 18px 45px rgba(0, 0, 0, 0.42),
    0 0 0 1px var(--color-cherenkov-soft, rgba(32, 200, 251, 0.16));
  padding: 1.15rem 1.25rem 1.2rem;
  color: #d5dce6;
}

.eyebrow {
  margin: 0 0 0.3rem;
  color: var(--color-cherenkov, #20c8fb);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
  color: #eef3f8;
}

.message {
  margin: 0 0 1rem;
  color: #aab4c2;
  font-size: 0.92rem;
  line-height: 1.4;
}

.game-choices {
  display: grid;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.game-choice {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid #3f4c63;
  border-radius: 7px;
  background: #2a3140;
  color: #d5dce6;
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.game-choice:hover {
  border-color: var(--color-brand-border, rgba(32, 200, 251, 0.38));
  background: color-mix(in srgb, var(--color-cherenkov) 12%, #344158);
}

.game-choice.occupied {
  border-color: #556176;
}

.game-choice-name {
  font-weight: 700;
}

.game-choice-meta {
  color: #8f98a8;
  font-size: 0.78rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.actions button {
  border: 1px solid #556176;
  border-radius: 7px;
  background: #303846;
  color: #d5dce6;
  padding: 0.45rem 0.75rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.actions button.primary {
  background: color-mix(in srgb, var(--color-cherenkov) 28%, #1a2830);
  border-color: var(--color-brand-border, rgba(32, 200, 251, 0.45));
  color: #e8f9ff;
}

.actions button.danger-outline {
  background: transparent;
  border-color: #8a5a4a;
  color: #ffb38a;
}

.actions button.muted {
  background: transparent;
  color: #aab0bc;
}

.actions button:hover {
  filter: brightness(1.08);
}
</style>
