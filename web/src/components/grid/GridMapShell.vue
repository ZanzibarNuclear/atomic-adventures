<script setup>
import { computed } from 'vue'
import './grid-map.css'

const props = defineProps({
  expanded: { type: Boolean, default: false },
  builderView: { type: Boolean, default: false },
  builderEdit: { type: Boolean, default: false },
  addPointMode: { type: Boolean, default: false },
  north: { type: String, default: 'up' },
  rotation: { type: Number, default: 0 },
  pathBuilderLegend: { type: Boolean, default: false },
  addPointHint: { type: Boolean, default: false },
  addNodeHint: { type: Boolean, default: false },
})

defineEmits(['rotate'])

const compassAngle = computed(() => {
  const base = props.north === 'right' ? 0 : 270
  return (base + props.rotation) % 360
})

const compassTip = computed(() => {
  const a = (compassAngle.value * Math.PI) / 180
  return { x: 23 + 17 * Math.cos(a), y: 23 + 17 * Math.sin(a) }
})

function compassLabelPoint(baseDeg, offsetDeg) {
  const a = ((baseDeg + offsetDeg) * Math.PI) / 180
  return { x: 23 + 17 * Math.cos(a), y: 23 + 17 * Math.sin(a) }
}

const compassCardinals = computed(() => {
  const n = compassAngle.value
  return [
    { id: 'E', ...compassLabelPoint(n, 90) },
    { id: 'S', ...compassLabelPoint(n, 180) },
    { id: 'W', ...compassLabelPoint(n, 270) },
  ]
})
</script>

<template>
  <div
    class="gridmap"
    :class="{
      expanded,
      'builder-view': builderView,
      'builder-edit': builderEdit,
      'add-point': addPointMode,
    }"
  >
    <div class="map-controls">
      <button class="rotate-btn" title="Rotate 90°" @click="$emit('rotate')">⟳</button>
      <svg class="compass" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="20" class="compass-ring" />
        <line x1="23" y1="23" :x2="compassTip.x" :y2="compassTip.y" class="compass-needle" />
        <circle :cx="compassTip.x" :cy="compassTip.y" r="2.4" class="compass-dot" />
        <text
          v-for="label in compassCardinals"
          :key="label.id"
          :x="label.x"
          :y="label.y"
          class="compass-cardinal"
        >{{ label.id }}</text>
        <text :x="compassTip.x" :y="compassTip.y" class="compass-n">N</text>
      </svg>
    </div>

    <slot />

    <div v-if="pathBuilderLegend" class="path-builder-legend" aria-label="Path editor legend">
      <div class="path-builder-legend-title">Path editor</div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-preview" />
        <span>Smoothed preview (selected path)</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-control" />
        <span>Control polygon (straight segments between points)</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-curve" />
        <span>Curve waypoint — drag to bend</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-node" />
        <span>Path node — stand spot on the route</span>
      </div>
      <div class="path-builder-legend-row">
        <span class="swatch swatch-dim" />
        <span>Other paths (background)</span>
      </div>
      <p v-if="addPointHint" class="path-builder-add-hint">
        Click the map: adds an orange waypoint on the nearest cyan segment.
      </p>
      <p v-else-if="addNodeHint" class="path-builder-add-hint path-builder-add-hint-node">
        Click the map: adds a green path node (stand spot) on the route.
      </p>
    </div>
  </div>
</template>
