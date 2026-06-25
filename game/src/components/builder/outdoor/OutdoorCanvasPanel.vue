<script setup>
import { onMounted, ref } from "vue";
import HexMap from "../../../lib/maps/components/HexMap.vue";

defineProps({
  loaded: { type: Boolean, default: false },
  canvasView: { type: String, default: "map" },
  zoomAction: { type: String, default: "fit" },
  selected: { type: Object, default: null },
  selectedIsPlacement: { type: Boolean, default: false },
  selectedIsLine: { type: Boolean, default: false },
  draftStart: { type: String, default: "" },
  outdoor: { type: Object, required: true },
  allHexIds: { type: Array, default: () => [] },
  allHexSet: { type: null, required: true },
  builderFlags: { type: null, required: true },
  builderEdit: { type: Boolean, default: false },
  editMode: { type: String, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  tool: { type: String, default: "select" },
  viewBoxString: { type: String, default: "" },
  editHandleScale: { type: Number, default: 1 },
  auditEntries: { type: Array, default: () => [] },
  panning: { type: Boolean, default: false },
  yamlText: { type: String, default: "" },
});

const emit = defineEmits([
  "canvas-mounted",
  "update:canvasView",
  "update:zoomAction",
  "zoom-action",
  "run-movement-audit",
  "wheel",
  "pointerdown",
  "select",
  "select-feature",
  "update:selectedHandleId",
  "waypoint-move",
  "builder-map-click",
]);

const canvasEl = ref(null);

onMounted(() => {
  emit("canvas-mounted", canvasEl.value);
});
</script>

<template>
  <section class="canvas-column">
    <div class="canvas-toolbar panel">
      <div class="tool-group">
        <label class="toolbar-field">
          <span>Zoom</span>
          <select
            :value="zoomAction"
            class="toolbar-select"
            aria-label="Map zoom actions"
            @change="
              $emit('update:zoomAction', $event.target.value);
              $emit('zoom-action', $event);
            "
          >
            <option value="fit">Fit map</option>
            <option value="focus" :disabled="!selected">Focus selection</option>
          </select>
        </label>
        <div class="segmented-control" aria-label="Canvas view">
          <button class="sm" :class="{ active: canvasView === 'map' }" @click="$emit('update:canvasView', 'map')">Map</button>
          <button class="sm" :class="{ active: canvasView === 'yaml' }" @click="$emit('update:canvasView', 'yaml')">YAML</button>
        </div>
        <button class="sm muted" @click="$emit('run-movement-audit')">Run movement audit</button>
      </div>
    </div>
    <div
      v-show="canvasView === 'map'"
      ref="canvasEl"
      class="world-canvas"
      :class="{ panning }"
      @wheel.prevent="$emit('wheel', $event)"
      @pointerdown="$emit('pointerdown', $event)"
    >
      <HexMap
        v-if="loaded"
        :map-data="outdoor.displayMapData"
        :route-models="outdoor.routeModels"
        :feature-models="outdoor.featureModels"
        :current-hex="selectedIsPlacement ? selected?.id ?? draftStart : draftStart"
        :discovered="allHexIds"
        :discovered-openings="outdoor.editableFeatures.map((feature) => feature.id)"
        :flags="builderFlags"
        :mode="'full'"
        :builder-view="true"
        :expanded="true"
        :builder-edit="builderEdit"
        :edit-mode="editMode"
        :edit-handles="editHandles"
        :edit-kind="selected?.kind ?? 'path'"
        :selected-handle-id="selectedHandleId"
        :add-point-mode="tool === 'add-point' && selectedIsLine"
        :clickable-hex-ids="allHexSet"
        :selectable-objects="tool !== 'add-point' || !selectedIsLine"
        :view-box-override="viewBoxString"
        :edit-handle-scale="editHandleScale"
        :movement-audit-entries="auditEntries"
        :avatar-instant="true"
        @hex-click="$emit('select', { type: 'hex', id: $event })"
        @route-select="$emit('select', { type: 'route', id: $event })"
        @feature-select="$emit('select-feature', $event)"
        @passage-select="$emit('select', { type: 'passage', id: $event })"
        @landmark-select="$emit('select', { type: 'landmark', id: $event })"
        @select-handle="$emit('update:selectedHandleId', $event)"
        @waypoint-move="$emit('waypoint-move', $event)"
        @builder-map-click="$emit('builder-map-click', $event)"
      />
      <p class="pan-hint">Wheel to zoom · Shift-drag or middle-drag to pan</p>
    </div>
    <pre v-show="canvasView === 'yaml'" class="yaml-canvas">{{ yamlText }}</pre>
  </section>
</template>

<style scoped>
.canvas-column {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.55rem;
  min-width: 0;
}

.panel {
  min-width: 0;
  border: 1px solid #343d4d;
  border-radius: 10px;
  background: #20252f;
  padding: 0.75rem;
}

.canvas-toolbar,
.tool-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.toolbar-field {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #bdc4ce;
  font-size: 0.8rem;
}

.toolbar-select {
  min-width: 8rem;
}

.segmented-control {
  display: flex;
  gap: 0.3rem;
}

.canvas-toolbar button.active {
  background: #49624f;
  border-color: #6f9b79;
}

.world-canvas {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #3b4655;
  border-radius: 11px;
  background: #1d241f;
}

.world-canvas :deep(.hexmap),
.world-canvas :deep(.hexmap.expanded) {
  height: 100%;
  min-height: 100%;
  border-radius: 0;
}

.world-canvas.panning {
  cursor: grabbing;
}

.pan-hint {
  position: absolute;
  left: 0.75rem;
  bottom: 0.55rem;
  margin: 0;
  padding: 0.25rem 0.45rem;
  border-radius: 6px;
  background: rgb(12 18 26 / 0.72);
  color: #b9c2cf;
  font-size: 0.72rem;
  pointer-events: none;
}

.yaml-canvas {
  min-height: 42rem;
  margin: 0;
  overflow: auto;
  padding: 0.85rem;
  border: 1px solid #3b4655;
  border-radius: 11px;
  background: #11151b;
  white-space: pre-wrap;
  font-size: 0.74rem;
}

@media (max-width: 900px) {
  .world-canvas {
    min-height: 68vh;
  }
}
</style>
