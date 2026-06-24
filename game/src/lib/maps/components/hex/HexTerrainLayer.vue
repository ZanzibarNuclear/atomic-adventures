<script setup>
import { hexCornerPoints } from '../../composables/useHexGeometry.js'

const props = defineProps({
  visibleHexes: { type: Array, default: () => [] },
  size: { type: Number, required: true },
  centerOf: { type: Function, required: true },
  fillOf: { type: Function, required: true },
  currentHex: { type: String, required: true },
  builderView: { type: Boolean, default: false },
  discoveredSet: { type: Set, required: true },
  /** When set, only these hex ids accept clicks (reachable travel targets). */
  clickableHexIds: { type: Object, default: null },
})

const emit = defineEmits(['hex-click'])

function onHexClick(hexId) {
  const allowed = props.clickableHexIds
  if (allowed && !allowed.has(hexId)) return
  emit('hex-click', hexId)
}

function terrainClipId(hex) {
  return `terrain-detail-${hex.id}`
}

function detailPoints(hex, points) {
  const c = props.centerOf(hex)
  return points
    .map(([x, y]) => `${c.x + x * props.size},${c.y + y * props.size}`)
    .join(' ')
}
</script>

<template>
  <g class="terrain-layer">
    <defs>
      <clipPath
        v-for="hex in visibleHexes"
        :key="`${hex.id}-clip`"
        :id="terrainClipId(hex)"
      >
        <polygon :points="hexCornerPoints(centerOf(hex).x, centerOf(hex).y, size)" />
      </clipPath>
    </defs>

    <g
      v-for="hex in visibleHexes"
      :key="hex.id"
      class="hex"
      :class="{
        current: hex.id === currentHex,
        'builder-unseen': builderView && !discoveredSet.has(hex.id),
        'hex-unreachable': props.clickableHexIds && !props.clickableHexIds.has(hex.id),
      }"
      @click="onHexClick(hex.id)"
    >
      <polygon
        :points="hexCornerPoints(centerOf(hex).x, centerOf(hex).y, size)"
        :fill="fillOf(hex)"
        class="tile"
      />
      <g
        v-if="hex.terrain === 'gorge'"
        class="terrain-detail gorge-detail"
        :clip-path="`url(#${terrainClipId(hex)})`"
      >
        <polygon
          :points="detailPoints(hex, [[-0.84, -0.42], [-0.34, -0.82], [0.02, -0.48], [-0.22, 0.04], [-0.68, 0.42], [-0.86, 0.06]])"
          class="gorge-wall gorge-wall-left"
        />
        <polygon
          :points="detailPoints(hex, [[0.14, -0.72], [0.78, -0.3], [0.84, 0.12], [0.4, 0.62], [0.1, 0.34], [0.26, -0.06]])"
          class="gorge-wall gorge-wall-right"
        />
        <polygon
          :points="detailPoints(hex, [[-0.72, -0.3], [-0.5, -0.42], [-0.39, -0.28], [-0.56, -0.14]])"
          class="gorge-scree"
        />
        <polygon
          :points="detailPoints(hex, [[0.42, 0.08], [0.66, 0.18], [0.52, 0.36], [0.28, 0.28]])"
          class="gorge-scree"
        />
        <circle :cx="centerOf(hex).x - size * 0.46" :cy="centerOf(hex).y + size * 0.18" :r="size * 0.055" class="gorge-scrub" />
        <circle :cx="centerOf(hex).x - size * 0.58" :cy="centerOf(hex).y - size * 0.12" :r="size * 0.045" class="gorge-scrub dark" />
        <circle :cx="centerOf(hex).x + size * 0.48" :cy="centerOf(hex).y - size * 0.2" :r="size * 0.052" class="gorge-scrub" />
        <circle :cx="centerOf(hex).x + size * 0.34" :cy="centerOf(hex).y + size * 0.4" :r="size * 0.047" class="gorge-scrub dark" />
      </g>
    </g>
  </g>
</template>

<style scoped>
.hex {
  cursor: pointer;
}
.hex.hex-unreachable {
  cursor: default;
  pointer-events: none;
}
.tile {
  stroke: rgba(0, 0, 0, 0.3);
  stroke-width: 1.5;
  transition: fill 0.3s ease;
}
.terrain-detail {
  pointer-events: none;
}
.gorge-wall {
  fill: rgba(126, 113, 91, 0.72);
  stroke: rgba(77, 68, 55, 0.36);
  stroke-width: 1;
}
.gorge-wall-left {
  fill: rgba(170, 162, 137, 0.74);
}
.gorge-wall-right {
  fill: rgba(137, 116, 86, 0.78);
}
.gorge-scree {
  fill: rgba(231, 223, 195, 0.52);
  stroke: rgba(91, 80, 66, 0.18);
  stroke-width: 0.8;
}
.gorge-scrub {
  fill: rgba(73, 99, 58, 0.72);
}
.gorge-scrub.dark {
  fill: rgba(48, 76, 51, 0.68);
}
.hex.current .tile {
  stroke: #ffd166;
  stroke-width: 3.5;
}
.hex.builder-unseen .tile {
  opacity: 0.38;
}
</style>
