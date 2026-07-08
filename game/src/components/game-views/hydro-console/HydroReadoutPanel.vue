<script setup>
defineProps({
  readouts: { type: Array, required: true },
});
</script>

<template>
  <div class="readout-panel">
    <div v-for="item in readouts" :key="item.id" class="readout">
      <span>{{ item.label }}</span>
      <strong>{{ item.value }}</strong>
    </div>
  </div>
</template>
