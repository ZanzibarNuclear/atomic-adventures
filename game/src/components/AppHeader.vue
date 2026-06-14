<template>
  <header>
    <div class="header-row">
      <div>
        <h1>Atomic Adventures</h1>
        <p class="sub">Part I — Zanzibar's World of Energy</p>
      </div>
      <div class="game-controls">
        <button class="sm" @click="$emit('save')">Save</button>
        <button v-if="hasSave" class="sm muted" @click="$emit('new-game')">
          New game
        </button>
        <button class="sm muted" @click="$emit('reset')">Reset</button>
      </div>
    </div>
    <p v-if="lastSavedAt" class="save-hint">
      Last saved {{ formattedSavedAt }}
    </p>
    <p v-if="loadError" class="error-hint">{{ loadError }}</p>
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
  if (!props.lastSavedAt) return "";
  try {
    return new Date(props.lastSavedAt).toLocaleString();
  } catch {
    return props.lastSavedAt;
  }
});
</script>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}
header h1 {
  font-size: 1.4rem;
  margin: 0 0 0.25rem;
}
.sub {
  color: #9aa0ac;
  margin: 0;
  font-size: 0.92rem;
}
.game-controls {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.save-hint {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: #6f7787;
}
.error-hint {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: #e07a7a;
}
</style>
