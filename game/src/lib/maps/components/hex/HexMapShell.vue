<script setup>
import { ref } from 'vue'
import LegendPassageIcon from './LegendPassageIcon.vue'
import './hex-map-shared.css'

defineProps({
  expanded: { type: Boolean, default: false },
  builderEdit: { type: Boolean, default: false },
  addPointMode: { type: Boolean, default: false },
  hasLegend: { type: Boolean, default: false },
  legendTerrains: { type: Array, default: () => [] },
  legendLines: { type: Array, default: () => [] },
  legendPassages: { type: Array, default: () => [] },
})

const rootRef = ref(null)
defineExpose({ rootRef })
</script>

<template>
  <div
    ref="rootRef"
    class="hexmap"
    :class="{ expanded, 'builder-edit': builderEdit, 'add-point': addPointMode }"
  >
    <slot />

    <div v-if="hasLegend" class="legend" aria-label="Map legend">
      <div class="legend-title">Legend</div>
      <ul class="legend-items">
        <li v-for="t in legendTerrains" :key="'lt-' + t.key" class="legend-item">
          <span class="legend-swatch" :style="{ background: t.color }" />
          <span class="legend-label">{{ t.label }}</span>
        </li>
        <li v-for="l in legendLines" :key="'ll-' + l.key" class="legend-item">
          <svg class="legend-line" viewBox="0 0 22 8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="21"
              y2="4"
              :stroke="l.stroke"
              :stroke-width="l.width"
              :stroke-dasharray="l.dash || undefined"
              stroke-linecap="round"
            />
          </svg>
          <span class="legend-label">{{ l.label }}</span>
        </li>
        <li v-for="p in legendPassages" :key="'lp-' + p.key" class="legend-item">
          <LegendPassageIcon :kind="p.kind" />
          <span class="legend-label">{{ p.label }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.hexmap {
  position: relative;
  width: 100%;
  height: var(--map-height);
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 25%, #34433a, #1d241f);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  transition: width 0.35s ease, height 0.35s ease;
}
.hexmap.expanded {
  height: var(--map-height-expanded);
}
.hexmap :deep(svg.map-svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.legend {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  width: max-content;
  max-width: calc(100% - 24px);
  padding: 8px 11px;
  border-radius: 8px;
  background: rgba(20, 28, 22, 0.78);
  border: 1px solid rgba(143, 174, 110, 0.35);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(3px);
  pointer-events: none;
}
.legend-title {
  margin-bottom: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b9c7ad;
}
.legend-items {
  display: grid;
  grid-template-columns: auto auto;
  gap: 3px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 7px;
}
.legend-swatch {
  width: 13px;
  height: 13px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.35);
  flex: 0 0 auto;
}
.legend-line {
  width: 18px;
  height: 8px;
  flex: 0 0 auto;
}
.legend-label {
  font-size: 11px;
  color: #eef2e6;
  white-space: nowrap;
}
</style>
