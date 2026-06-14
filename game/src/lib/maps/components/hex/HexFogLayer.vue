<script setup>
import { hexCornerPoints } from '../../composables/useHexGeometry.js'
import { FOG_COLOR } from '../../composables/hexMapPalette.js'

defineProps({
  fogHexes: { type: Array, default: () => [] },
  size: { type: Number, required: true },
  centerOf: { type: Function, required: true },
  /** When true, fog tiles are valid move targets (e.g. slice mode). */
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['hex-click'])
</script>

<template>
  <g class="fog-layer">
    <g
      v-for="hex in fogHexes"
      :key="'fog-' + hex.id"
      class="hex fog"
      :class="{ clickable }"
      @click="emit('hex-click', hex.id)"
    >
      <polygon
        :points="hexCornerPoints(centerOf(hex).x, centerOf(hex).y, size)"
        :fill="FOG_COLOR"
      />
      <text :x="centerOf(hex).x" :y="centerOf(hex).y + 6" class="fog-mark">?</text>
    </g>
  </g>
</template>

<style scoped>
.hex.fog {
  cursor: default;
}
.hex.fog.clickable {
  cursor: pointer;
}
.fog polygon {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
}
.fog-mark {
  fill: rgba(255, 255, 255, 0.3);
  font-size: 22px;
  text-anchor: middle;
  font-weight: 700;
}
</style>
