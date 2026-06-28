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
  margin-bottom: 1rem;
  padding: 1rem 1.15rem;
  border: 1px solid #5a5d60;
  border-radius: 12px;
  background: #454749;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}
.status-line {
  margin: 0;
  line-height: 1.6;
  color: #c8cdd6;
  font-size: 0.94rem;
}
.status-line + .status-line {
  margin-top: 0.85rem;
}
</style>
