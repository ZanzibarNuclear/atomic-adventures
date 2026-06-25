<script setup>
import { computed } from "vue";
import GridMap from "../../../lib/maps/components/GridMap.vue";

const props = defineProps({
  loaded: { type: Boolean, default: false },
  building: { type: Object, required: true },
  selection: { type: Object, default: null },
  allRoomIds: { type: Array, default: () => [] },
  allExteriorIds: { type: Array, default: () => [] },
  level: { type: String, default: "" },
  viewportMode: { type: String, default: "fit-all" },
  exteriorFog: { type: Boolean, default: false },
  geometryEditing: { type: Boolean, default: false },
  canEditGeometry: { type: Boolean, default: false },
  doorStates: { type: Object, required: true },
  editMode: { type: String, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  addMode: { type: String, default: null },
});

defineEmits([
  "update:level",
  "update:viewportMode",
  "update:exteriorFog",
  "update:selectedHandleId",
  "toggle-geometry-editing",
  "set-door-preview",
  "select-item",
  "grid-handle-move",
  "builder-map-click",
  "stand-click",
]);

const currentRoom = computed(() => {
  if (props.selection?.source === "rooms") return props.selection.id;
  if (props.selection?.source === "stands") return props.selection.id.split("/")[0];
  return "";
});

const currentStand = computed(() =>
  props.selection?.source === "stands" ? props.selection.id.split("/")[1] : null,
);
</script>

<template>
  <section class="canvas-column">
    <div class="canvas-toolbar panel">
      <div class="tool-group">
        <label>Floor
          <select :value="level" @change="$emit('update:level', $event.target.value)">
            <option v-for="item in building.levels" :key="item.id" :value="item.id">
              {{ item.label }}
            </option>
          </select>
        </label>
        <label>Camera
          <select :value="viewportMode" @change="$emit('update:viewportMode', $event.target.value)">
            <option value="fit-all">Fit all</option>
            <option value="gameplay">Gameplay preview</option>
          </select>
        </label>
        <label class="check-field">
          <input
            :checked="exteriorFog"
            type="checkbox"
            @change="$emit('update:exteriorFog', $event.target.checked)"
          />
          Exterior fog
        </label>
      </div>
      <div class="tool-group">
        <button
          class="sm"
          :class="{ active: geometryEditing }"
          :disabled="!canEditGeometry"
          @click="$emit('toggle-geometry-editing')"
        >
          {{ geometryEditing ? "Done editing" : "Edit geometry" }}
        </button>
        <span v-if="geometryEditing" class="mode-indicator">Geometry editing</span>
        <button class="sm muted" @click="$emit('set-door-preview', true)">Open all doors</button>
        <button class="sm muted" @click="$emit('set-door-preview', false)">Close all doors</button>
      </div>
    </div>

    <div class="station-canvas">
      <GridMap
        v-if="loaded"
        :building="building"
        :current-room="currentRoom"
        :current-stand="currentStand"
        :discovered="allRoomIds"
        :revealed="allRoomIds"
        :level="level"
        :stand-level="level"
        :reachable-rooms="allRoomIds"
        :reachable-exterior-nodes="allExteriorIds"
        :door-states="doorStates"
        :builder-view="true"
        :builder-edit="geometryEditing"
        :edit-mode="editMode"
        :edit-handles="editHandles"
        :selected-handle-id="selectedHandleId"
        :selected-item-id="selection?.id ?? ''"
        :add-point-mode="!!addMode"
        :map-click-mode="addMode"
        :hydro-discovered="true"
        :viewport-mode="viewportMode"
        :exterior-fog="exteriorFog"
        :wheel-zoom="true"
        :drag-pan="true"
        @select-item="$emit('select-item', $event)"
        @select-handle="$emit('update:selectedHandleId', $event)"
        @grid-handle-move="$emit('grid-handle-move', $event)"
        @builder-map-click="$emit('builder-map-click', $event)"
        @room-click="$emit('select-item', { source: 'rooms', id: $event })"
        @exterior-node-click="$emit('select-item', { source: 'nodes', id: $event })"
        @stand-click="$emit('stand-click', $event)"
      />
    </div>
    <p class="canvas-hint">Drag empty map to pan · Drag a selected stand or colored handle to move it · Wheel to zoom</p>
  </section>
</template>

<style scoped>
.canvas-column {
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 0.65rem;
}

.panel {
  border: 1px solid #303848;
  border-radius: 8px;
  background: #202733;
  padding: 0.75rem;
}

.canvas-toolbar,
.tool-group {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.canvas-toolbar {
  justify-content: space-between;
}

.canvas-toolbar select {
  min-width: 9rem;
}

.canvas-toolbar label,
.check-field {
  display: grid;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: #bdc4ce;
}

.check-field {
  display: flex;
  align-items: center;
}

.check-field input {
  width: auto;
}

.station-canvas {
  min-height: 0;
  overflow: hidden;
  border: 1px solid #3b4655;
  border-radius: 11px;
}

.station-canvas :deep(.gridmap),
.station-canvas :deep(.gridmap.builder-view:not(.expanded)) {
  height: clamp(34rem, calc(100vh - 15rem), 54rem);
  max-height: none;
}

.canvas-hint {
  margin: 0;
  color: #93a0af;
  font-size: 0.78rem;
}

.mode-indicator {
  color: #ffcf80;
  font-size: 0.8rem;
}

@media (max-width: 920px) {
  .station-canvas {
    min-height: 68vh;
  }
}
</style>
