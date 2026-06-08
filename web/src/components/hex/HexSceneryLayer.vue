<template>
  <g class="tree-layer">
    <g
      v-for="t in trees"
      :key="t.key"
      :transform="`translate(${t.x},${t.y}) scale(${t.scale})`"
    >
      <rect x="-1.4" y="-3" width="2.8" height="6" fill="#5b4329" />
      <polygon points="-7,-2 7,-2 0,-13" fill="#2f5e3a" />
      <polygon points="-5,-9 5,-9 0,-19" fill="#356c43" />
    </g>
  </g>
</template>

<script setup>
defineProps({
  trees: { type: Array, default: () => [] },
})
</script>

<style scoped>
.tree-layer {
  pointer-events: none;
}
</style>
