<template>
  <header class="builder-page-header">
    <div class="builder-page-title">
      <h2>{{ title }}</h2>
      <slot name="tabs" />
    </div>
    <div v-if="$slots.actions" class="builder-page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
})
</script>

<style scoped>
.builder-page-header,
.builder-page-title,
.builder-page-actions {
  display: flex;
  align-items: center;
  gap: .75rem;
  flex-wrap: wrap;
}
.builder-page-header {
  justify-content: space-between;
}
.builder-page-actions {
  gap: .5rem;
}
.builder-page-header h2 {
  margin: 0;
}
</style>
