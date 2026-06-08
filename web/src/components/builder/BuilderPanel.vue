<template>
  <div class="builder-panel">
    <slot />
  </div>
</template>

<style scoped>
.builder-panel {
  display: grid;
  gap: 0.65rem;
  padding: 0.85rem;
  background: #1a1f28;
  border: 1px solid #3a4558;
  border-radius: 8px;
}
</style>
