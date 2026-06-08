<script setup>
import { computed, ref } from 'vue'
import { northOrientationBase } from '../../composables/grid/useGridCompass.js'
import './grid-map-shared.css'

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
  return (northOrientationBase(props.north) + props.rotation) % 360
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

const rootRef = ref(null)
defineExpose({ rootRef })
</script>

<template>
  <div
    ref="rootRef"
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

<style scoped>
.gridmap {
  position: relative;
  width: 220px;
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
  container-type: size;
  background: radial-gradient(circle at 50% 30%, #2c3340, #181c24);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
}
.gridmap.expanded {
  width: 100%;
  height: 72vh;
}
.gridmap.builder-view {
  box-shadow: inset 0 0 0 2px rgba(200, 162, 255, 0.35);
}
.gridmap.builder-view:not(.expanded) {
  width: 100%;
  height: min(58vh, 560px);
}
.gridmap.builder-edit.add-point {
  cursor: crosshair;
}
.gridmap :deep(svg:not(.compass)) {
  width: 100%;
  height: 100%;
  display: block;
}
.path-builder-legend {
  position: absolute;
  left: clamp(6px, 2.5cqmin, 14px);
  bottom: clamp(6px, 2.5cqmin, 14px);
  z-index: 2;
  max-width: min(240px, 88%);
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(12, 14, 18, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 10px;
  line-height: 1.35;
  color: #d8dde6;
  pointer-events: none;
}
.path-builder-legend-title {
  font-weight: 700;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a8b0bd;
  margin-bottom: 6px;
}
.path-builder-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.path-builder-legend .swatch {
  flex-shrink: 0;
  width: 22px;
  height: 0;
  border-top-width: 3px;
  border-top-style: solid;
  border-radius: 1px;
}
.path-builder-legend .swatch-preview {
  border-top-color: #e878a8;
}
.path-builder-legend .swatch-control {
  border-top-color: #58c4e8;
  border-top-style: dashed;
}
.path-builder-legend .swatch-curve {
  width: 10px;
  height: 10px;
  border: 2.5px solid #f4a261;
  border-radius: 50%;
  border-top: 2.5px solid #f4a261;
}
.path-builder-legend .swatch-node {
  width: 10px;
  height: 10px;
  border: 2.5px solid #7dcea0;
  border-radius: 50%;
  border-top: 2.5px solid #7dcea0;
}
.path-builder-legend .swatch-dim {
  border-top-color: #5c574e;
  border-top-style: dashed;
  opacity: 0.7;
}
.path-builder-add-hint {
  margin: 8px 0 0;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #f4a261;
  font-size: 9px;
  line-height: 1.4;
}
.path-builder-add-hint-node {
  color: #7dcea0;
}
.map-controls {
  position: absolute;
  right: clamp(6px, 2.5cqmin, 14px);
  top: clamp(6px, 2.5cqmin, 14px);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: clamp(4px, 1.5cqmin, 10px);
  --ctrl-size: clamp(28px, 13cqmin, 54px);
}
.rotate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--ctrl-size);
  height: var(--ctrl-size);
  padding: 0;
  font-size: calc(var(--ctrl-size) * 0.62);
  line-height: 1;
  border-radius: 7px;
  background: rgba(20, 24, 30, 0.8);
  color: #cdd3dd;
  border: 1px solid #3f4c63;
  cursor: pointer;
}
.rotate-btn:hover {
  background: rgba(40, 48, 60, 0.9);
}
.compass {
  width: calc(var(--ctrl-size) * 1.35);
  height: calc(var(--ctrl-size) * 1.35);
  pointer-events: none;
  flex-shrink: 0;
}
.compass-ring {
  fill: rgba(20, 24, 30, 0.55);
  stroke: #3f4c63;
  stroke-width: 1.5;
}
.compass-needle {
  stroke: #6db97f;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.compass-dot {
  fill: #6db97f;
}
.compass-n {
  fill: #6db97f;
  font-size: 8px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: #181c24;
  stroke-width: 2.5px;
}
.compass-cardinal {
  fill: #9aa3b2;
  font-size: 7px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: #181c24;
  stroke-width: 2px;
}
</style>
