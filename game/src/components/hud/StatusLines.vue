<template>
  <div v-if="lines.length" class="status-lines">
    <p v-for="line in lines" :key="line" class="status-line">{{ line }}</p>
  </div>
</template>

<script setup>
defineProps({
  lines: { type: Array, default: () => [] },
});
</script>

<style scoped>
.status-lines {
  margin-top: 0.25rem;
}
.status-line {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: #8bc49a;
}
</style>
