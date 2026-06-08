<script setup>
import { hexCornerPoints } from '../../composables/useHexGeometry.js'

defineProps({
  visibleHexes: { type: Array, default: () => [] },
  size: { type: Number, required: true },
  centerOf: { type: Function, required: true },
  fillOf: { type: Function, required: true },
  currentHex: { type: String, required: true },
  builderView: { type: Boolean, default: false },
  discoveredSet: { type: Set, required: true },
})

const emit = defineEmits(['hex-click'])
</script>

<template>
  <g class="terrain-layer">
    <g
      v-for="hex in visibleHexes"
      :key="hex.id"
      class="hex"
      :class="{
        current: hex.id === currentHex,
        'builder-unseen': builderView && !discoveredSet.has(hex.id),
      }"
      @click="emit('hex-click', hex.id)"
    >
      <polygon
        :points="hexCornerPoints(centerOf(hex).x, centerOf(hex).y, size)"
        :fill="fillOf(hex)"
        class="tile"
      />
    </g>
  </g>
</template>

<style scoped>
.hex {
  cursor: pointer;
}
.tile {
  stroke: rgba(0, 0, 0, 0.3);
  stroke-width: 1.5;
  transition: fill 0.3s ease;
}
.hex.current .tile {
  stroke: #ffd166;
  stroke-width: 3.5;
}
.hex.builder-unseen .tile {
  opacity: 0.38;
}
</style>
