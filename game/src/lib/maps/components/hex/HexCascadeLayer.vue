<template>
  <g class="cascade-layer">
    <path
      v-for="c in cascadeChevrons"
      :key="c.key"
      :d="c.d"
      class="cascade-chevron"
    />
  </g>
</template>

<script setup>
defineProps({
  cascadeChevrons: { type: Array, default: () => [] },
})
</script>

<style scoped>
.cascade-layer {
  pointer-events: none;
}
.cascade-chevron {
  fill: none;
  stroke: #e8f4ff;
  stroke-width: 2.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  paint-order: stroke;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.45));
}
</style>
