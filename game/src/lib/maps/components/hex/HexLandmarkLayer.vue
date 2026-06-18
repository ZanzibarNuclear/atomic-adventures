<script setup>
import UtilityStationLandmark from '../UtilityStationLandmark.vue'
import { landmarkLabel } from '../../../displayLabel.js'

defineProps({
  landmarkHexes: { type: Array, default: () => [] },
  size: { type: Number, required: true },
  centerOf: { type: Function, required: true },
  currentHex: { type: String, required: true },
  buildingEnterable: { type: Boolean, default: false },
  builderEdit: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false },
})

const emit = defineEmits(['building-enter', 'select'])
</script>

<template>
  <g class="landmark-layer">
    <g
      v-for="hex in landmarkHexes"
      :key="'lm-' + hex.id"
      class="landmark"
      :class="{ selectable }"
      @click.stop="selectable && emit('select', hex.id)"
    >
      <g
        v-if="hex.landmark.building === 'utility-station'"
        class="building-enter"
        :class="{ 'can-enter': hex.id === currentHex && buildingEnterable && !builderEdit }"
        :transform="`translate(${centerOf(hex).x + (hex.landmark.dx ?? 0) * size}, ${centerOf(hex).y + (hex.landmark.dy ?? 0) * size}) scale(0.54)`"
        @click.stop="emit('building-enter', hex)"
      >
        <UtilityStationLandmark />
      </g>
      <text
        v-else-if="hex.landmark.icon"
        :x="centerOf(hex).x + (hex.landmark.dx ?? 0) * size"
        :y="centerOf(hex).y + 2 + (hex.landmark.dy ?? 0) * size"
        class="landmark-icon"
      >
        {{ hex.landmark.icon }}
      </text>
      <text
        v-if="expanded"
        :x="centerOf(hex).x + (hex.landmark.dx ?? 0) * size"
        :y="centerOf(hex).y + size * 0.78"
        class="landmark-label"
      >
        {{ landmarkLabel(hex.landmark) }}
      </text>
    </g>
  </g>
</template>

<style scoped>
.building-enter.can-enter {
  cursor: pointer;
}
.landmark.selectable { cursor: pointer; }
.building-enter.can-enter:hover :deep(.us-wall) {
  filter: brightness(1.08);
}
.landmark-icon {
  font-size: 26px;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}
.landmark-label {
  fill: #f4f1de;
  font-size: 12px;
  text-anchor: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.6);
  stroke-width: 3px;
  pointer-events: none;
}
</style>
