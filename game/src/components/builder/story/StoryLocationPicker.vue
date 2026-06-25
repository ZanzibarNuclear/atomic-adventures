<script setup>
import HexMap from "../../../lib/maps/components/HexMap.vue";
import GridMap from "../../../lib/maps/components/GridMap.vue";
import { buildInitialDoorState } from "../../../lib/maps/composables/useDoors.js";

defineProps({
  locationMode: { type: String, required: true },
  selectedLocation: { type: String, default: "" },
  outdoor: { type: Object, required: true },
  building: { type: Object, required: true },
  buildingData: { type: Object, required: true },
  allHexIds: { type: Array, default: () => [] },
  allHexSet: { type: Object, required: true },
  allRoomIds: { type: Array, default: () => [] },
  allExteriorIds: { type: Array, default: () => [] },
  builderFlags: { type: Object, required: true },
  selectedRoom: { type: String, default: "" },
  selectedExterior: { type: String, default: "" },
  indoorLevel: { type: String, default: "" },
  indoorViewportMode: { type: String, default: "gameplay" },
  previewExteriorFog: { type: Boolean, default: false },
  eventLocationInput: { type: String, default: "" },
});

defineEmits([
  "switch-mode",
  "select-hex",
  "select-room",
  "select-exterior",
  "select-indoor-item",
  "update:indoorLevel",
  "update:indoorViewportMode",
  "update:previewExteriorFog",
  "update:eventLocationInput",
  "select-event",
]);
</script>

<template>
  <section class="builder-map-column panel">
    <div class="mode-tabs">
      <button :class="{ active: locationMode === 'outdoors' }" @click="$emit('switch-mode', 'outdoors')">Outdoor</button>
      <button :class="{ active: ['rooms', 'exterior'].includes(locationMode) }" @click="$emit('switch-mode', 'rooms')">Indoor</button>
      <button :class="{ active: locationMode === 'events' }" @click="$emit('switch-mode', 'events')">Events</button>
    </div>

    <HexMap
      v-if="locationMode === 'outdoors'"
      :map-data="outdoor.displayMapData"
      :route-models="outdoor.routeModels"
      :feature-models="outdoor.featureModels"
      :current-hex="selectedLocation"
      :discovered="allHexIds"
      :flags="builderFlags"
      :mode="'full'"
      :builder-view="true"
      :clickable-hex-ids="allHexSet"
      :avatar-instant="true"
      @hex-click="$emit('select-hex', $event)" />

    <template v-else-if="locationMode !== 'events'">
      <div class="indoor-preview-controls">
        <label>Floor
          <select :value="indoorLevel" @change="$emit('update:indoorLevel', $event.target.value)">
            <option v-for="level in buildingData.levels" :key="level.id" :value="level.id">{{ level.label }}</option>
          </select>
        </label>
        <label>Camera
          <select :value="indoorViewportMode" @change="$emit('update:indoorViewportMode', $event.target.value)">
            <option value="gameplay">Gameplay preview</option>
            <option value="fit-all">Fit all</option>
          </select>
        </label>
        <label class="preview-check">
          <input
            :checked="previewExteriorFog"
            type="checkbox"
            @change="$emit('update:previewExteriorFog', $event.target.checked)">
          Exterior fog
        </label>
      </div>
      <GridMap
        :building="building"
        :current-room="selectedRoom"
        :exterior-node="selectedExterior"
        :discovered="allRoomIds"
        :revealed="allRoomIds"
        :level="indoorLevel"
        :stand-level="indoorLevel"
        :reachable-rooms="allRoomIds"
        :reachable-exterior-nodes="allExteriorIds"
        :door-states="buildInitialDoorState(building.areaId, building)"
        :builder-view="true"
        :hydro-discovered="true"
        :viewport-mode="indoorViewportMode"
        :exterior-fog="previewExteriorFog"
        :orientation-controls="false"
        :wheel-zoom="true"
        :drag-pan="true"
        @room-click="$emit('select-room', $event)"
        @exterior-node-click="$emit('select-exterior', $event)"
        @select-item="$emit('select-indoor-item', $event)" />
    </template>

    <label v-else>Event name
      <input
        :value="eventLocationInput"
        placeholder="custom-event"
        @input="$emit('update:eventLocationInput', $event.target.value)"
        @change="$emit('select-event', $event)" />
    </label>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid #343d4d;
  border-radius: 10px;
  background: #20252f;
  padding: 0.85rem;
}

.mode-tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.mode-tabs button.active {
  background: #49624f;
  border-color: #6f9b79;
}

.indoor-preview-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}

label {
  display: grid;
  gap: 0.25rem;
}

input,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 6px;
  background: #171b22;
  color: #dbe2ea;
  padding: 0.45rem;
}

.preview-check {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.preview-check input {
  width: auto;
}

@media (max-width: 900px) {
  .indoor-preview-controls {
    grid-template-columns: 1fr;
  }
}
</style>
