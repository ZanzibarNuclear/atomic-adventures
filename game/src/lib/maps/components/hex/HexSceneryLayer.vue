<template>
  <g class="scenery-layer">
    <g
      v-for="item in rockyShrubs"
      :key="item.key"
      :transform="`translate(${item.x},${item.y}) rotate(${item.rotate}) scale(${item.scale})`"
    >
      <circle cx="-3.6" cy="0.8" r="3.3" fill="#5f7445" />
      <circle cx="1" cy="-1.7" r="3.9" fill="#6d814b" />
      <circle cx="4.2" cy="1.2" r="2.8" fill="#516a3d" />
    </g>
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
  rockyShrubs: { type: Array, default: () => [] },
})
</script>

<style scoped>
.scenery-layer {
  pointer-events: none;
}
</style>
