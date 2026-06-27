<template>
  <nav class="builder-workspace-tabs" :aria-label="ariaLabel">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :class="{ active: item.id === activeId }"
      @click="$emit('select', item.id)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>

<script setup>
defineProps({
  ariaLabel: { type: String, required: true },
  items: { type: Array, required: true },
  activeId: { type: String, required: true },
})

defineEmits(['select'])
</script>

<style scoped>
.builder-workspace-tabs {
  display: flex;
  align-items: center;
  gap: .35rem;
  flex-wrap: wrap;
}
.builder-workspace-tabs button {
  padding: .45rem .9rem;
  border: 1px solid #3c4658;
  border-radius: 8px;
  background: #171b22;
  color: #aeb5c0;
}
.builder-workspace-tabs button.active {
  border-color: #6f9b79;
  background: #49624f;
  color: #eef7f0;
}
</style>
