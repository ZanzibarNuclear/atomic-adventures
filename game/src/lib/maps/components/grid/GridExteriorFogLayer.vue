<template>
  <g v-if="visible" class="exterior-fog-layer" pointer-events="none">
    <defs>
      <filter :id="blurId" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur :stdDeviation="feather" />
      </filter>
      <mask :id="maskId" maskUnits="userSpaceOnUse">
        <rect
          :x="viewBox.x"
          :y="viewBox.y"
          :width="viewBox.w"
          :height="viewBox.h"
          fill="white"
        />
        <g fill="black" stroke="black">
          <path
            v-for="(ring, index) in buildingShell"
            :key="'fog-shell-' + index"
            :d="ringPath(ring)"
            :stroke-width="clearance * 0.35"
          />
          <polyline
            v-for="path in paths"
            :key="'fog-path-' + path.id"
            :points="path.points"
            fill="none"
            :stroke-width="clearance"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-for="node in nodes"
            :key="'fog-node-' + node.id"
            :cx="node.cx"
            :cy="node.cy"
            :r="clearance * 0.58"
          />
        </g>
        <g
          fill="none"
          stroke="black"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.72"
          :filter="`url(#${blurId})`"
        >
          <polyline
            v-for="path in paths"
            :key="'fog-feather-' + path.id"
            :points="path.points"
            :stroke-width="clearance * 1.35"
          />
        </g>
      </mask>
    </defs>

    <rect
      :x="viewBox.x"
      :y="viewBox.y"
      :width="viewBox.w"
      :height="viewBox.h"
      class="fog-fill"
      :mask="`url(#${maskId})`"
    />
  </g>
</template>

<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: true },
  viewBox: { type: Object, required: true },
  buildingShell: { type: Array, default: () => [] },
  paths: { type: Array, default: () => [] },
  nodes: { type: Array, default: () => [] },
  cell: { type: Number, default: 64 },
})

const uid = useId().replace(/:/g, '')
const maskId = `grid-exterior-fog-${uid}`
const blurId = `grid-exterior-fog-blur-${uid}`
const clearance = computed(() => props.cell * 0.78)
const feather = computed(() => props.cell * 0.08)

function ringPath(ring) {
  if (!ring.length) return ''
  return ring
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ') + ' Z'
}
</script>

<style scoped>
.fog-fill {
  fill: rgba(8, 11, 15, 0.88);
}
</style>
