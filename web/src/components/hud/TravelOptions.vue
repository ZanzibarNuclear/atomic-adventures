<template>
  <div class="travel">
    <span class="label">{{ label }}</span>
    <div class="options">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: "Move" },
});
</script>

<style scoped>
.travel .options {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.35rem;
}
</style>
