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
  allHexSet: { type: null, required: true },
  allRoomIds: { type: Array, default: () => [] },
  allExteriorIds: { type: Array, default: () => [] },
  builderFlags: { type: null, required: true },
  selectedRoom: { type: String, default: "" },
  selectedExterior: { type: String, default: "" },
  indoorLevel: { type: String, default: "" },
  indoorViewportMode: { type: String, default: "gameplay" },
});

defineEmits([
  "select-hex",
  "select-room",
  "select-exterior",
  "select-indoor-item",
  "update:indoorLevel",
  "update:indoorViewportMode",
]);
</script>

<template>
  <section class="builder-map-column panel">
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
      :show-legend="false"
      @hex-click="$emit('select-hex', $event)" />

    <template v-else>
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
        builder-fixture-click-target="feature-room"
        :hydro-discovered="true"
        :viewport-mode="indoorViewportMode"
        :orientation-controls="false"
        :wheel-zoom="true"
        :drag-pan="true"
        @room-click="$emit('select-room', $event)"
        @exterior-node-click="$emit('select-exterior', $event)"
        @select-item="$emit('select-indoor-item', $event)" />
    </template>
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

.indoor-preview-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

@media (max-width: 900px) {
  .indoor-preview-controls {
    grid-template-columns: 1fr;
  }
}
</style>
