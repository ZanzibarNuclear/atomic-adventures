<template>
  <div class="actions">
    <span class="label">{{ label }}</span>
    <div class="options">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: "Choose an Action" },
});
</script>

<style scoped>
.actions {
  margin-top: -0.35rem;
}
.actions .label {
  color: var(--color-cherenkov, #20c8fb);
}
.actions .options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
  margin-top: 0.35rem;
}
</style>
