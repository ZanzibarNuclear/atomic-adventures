<template>
  <header>
    <div class="header-row">
      <div class="title-block">
        <h1>Atomic Adventures</h1>
        <p class="sub">Part I — Zanzibar's World of Energy</p>
      </div>
      <div class="controls-column">
        <div class="game-controls">
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
import { computed } from "vue";

const props = defineProps({
  hasSave: { type: Boolean, default: false },
  lastSavedAt: { type: String, default: null },
  loadError: { type: String, default: null },
});

defineEmits(["save", "new-game", "reset"]);

const formattedSavedAt = computed(() => {
  const raw = props.lastSavedAt;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
});

const showSaveHint = computed(() => formattedSavedAt.value.length > 0);
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
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-end;
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
