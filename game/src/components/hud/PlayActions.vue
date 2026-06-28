<template>
  <div v-if="items.length" class="play-actions">
    <span class="label">{{ label }}</span>
    <div class="action-grid">
      <div v-for="item in items" :key="item.id" class="action-chip">
        <button
          class="sm"
          :disabled="item.disabled"
          :title="item.hint ?? ''"
          @click="$emit('select', item.id)">
          {{ item.label }}
        </button>
        <span v-if="item.hint" class="action-hint">{{ item.hint }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: "Actions" },
});

defineEmits(["select"]);
</script>

<style scoped>
.play-actions {
  margin-top: 0;
}
.action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.65rem;
  margin-top: 0.35rem;
  align-items: baseline;
}
.action-chip {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  max-width: 100%;
}
.action-hint {
  font-size: 0.78rem;
  color: #6f7787;
}
</style>
