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
  geometryEditing: { type: Boolean, default: false },
  canEditGeometry: { type: Boolean, default: false },
  doorStates: { type: Object, required: true },
  editMode: { type: String, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  addMode: { type: String, default: null },
  auditResult: { type: Object, default: null },
});

defineEmits([
  "update:level",
  "update:viewportMode",
  "update:selectedHandleId",
  "toggle-geometry-editing",
  "select-item",
  "grid-handle-move",
  "builder-map-click",
  "stand-click",
  "run-traversal-audit",
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
        <button class="sm muted" @click="$emit('run-traversal-audit')">
          Run traversal audit
        </button>
      </div>
    </div>

    <section v-if="auditResult" class="audit-summary" :class="{ warning: !auditResult.valid }">
      <p v-if="auditResult.valid">
        Traversal audit passed: {{ auditResult.roomCount }} rooms and
        {{ auditResult.exteriorNodeCount }} exterior nodes are connected.
      </p>
      <template v-else>
        <p>
          Traversal audit found
          {{ auditResult.unreachableRooms.length }} unreachable room(s) and
          {{ auditResult.unreachableExteriorNodes.length }} unreachable exterior node(s).
        </p>
        <p v-if="auditResult.unreachableRooms.length">
          Rooms: {{ auditResult.unreachableRooms.join(", ") }}
        </p>
        <p v-if="auditResult.unreachableExteriorNodes.length">
          Exterior nodes: {{ auditResult.unreachableExteriorNodes.join(", ") }}
        </p>
      </template>
    </section>

    <p class="canvas-hint">Drag empty map to pan · Drag a selected stand or colored handle to move it · Wheel to zoom</p>

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
  </section>
</template>

<style scoped>
.canvas-column {
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 0.5rem;
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

.audit-summary {
  display: grid;
  gap: 0.2rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(139, 196, 154, 0.35);
  border-radius: 8px;
  background: rgba(29, 45, 35, 0.78);
}

.audit-summary.warning {
  border-color: rgba(239, 203, 131, 0.42);
  background: rgba(52, 42, 27, 0.78);
}

.audit-summary p {
  margin: 0;
  color: #cfe6d3;
  font-size: 0.78rem;
  line-height: 1.45;
}

.audit-summary.warning p {
  color: #efcb83;
}

.canvas-toolbar select {
  min-width: 9rem;
}

.canvas-toolbar label {
  display: grid;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: #bdc4ce;
}

.station-canvas {
  min-height: 0;
  overflow: hidden;
  border: 1px solid #3b4655;
  border-radius: 11px;
}

.station-canvas :deep(.gridmap),
.station-canvas :deep(.gridmap.builder-view:not(.expanded)) {
  height: clamp(33rem, calc(100vh - 15.5rem), 54rem);
  max-height: none;
}

.canvas-hint {
  margin: 0;
  color: #93a0af;
  font-size: 0.78rem;
}

@media (max-width: 920px) {
  .station-canvas {
    min-height: 68vh;
  }
}
</style>
