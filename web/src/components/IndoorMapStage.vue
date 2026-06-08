<template>
  <GridMap
    :building="building"
    :current-room="currentRoom"
    :exterior-node="exteriorNode"
    :discovered="discovered"
    :revealed="revealed"
    :level="level"
    :stand-level="standLevel"
    :reachable-rooms="reachableRooms"
    :reachable-exterior-nodes="reachableExteriorNodes"
    :door-states="doorStates"
    :builder-view="builderView"
    :builder-edit="builderEdit"
    :edit-mode="editMode"
    :edit-handles="editHandles"
    :selected-handle-id="selectedHandleId"
    :selected-item-id="selectedItemId"
    :add-point-mode="addPointMode"
    :map-click-mode="mapClickMode"
    :expanded="expanded"
    :interactable-door-ids="interactableDoorIds"
    :reachable-exit-doors="reachableExitDoors"
    @room-click="$emit('room-click', $event)"
    @exterior-node-click="$emit('exterior-node-click', $event)"
    @door-click="$emit('door-click', $event)"
    @exit-click="$emit('exit-click', $event)"
    @select-handle="$emit('select-handle', $event)"
    @grid-handle-move="$emit('grid-handle-move', $event)"
    @builder-map-click="$emit('builder-map-click', $event)"
    @select-item="$emit('select-item', $event)" />
</template>

<script setup>
import GridMap from "./GridMap.vue";

defineProps({
  building: { type: Object, required: true },
  currentRoom: { type: String, default: "" },
  exteriorNode: { type: String, default: null },
  discovered: { type: Array, default: () => [] },
  revealed: { type: Array, default: () => [] },
  level: { type: String, required: true },
  standLevel: { type: String, default: null },
  reachableRooms: { type: Array, default: () => [] },
  reachableExteriorNodes: { type: Array, default: () => [] },
  doorStates: { type: Object, default: () => ({}) },
  builderView: { type: Boolean, default: false },
  builderEdit: { type: Boolean, default: false },
  editMode: { type: String, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  selectedItemId: { type: String, default: "" },
  addPointMode: { type: Boolean, default: false },
  mapClickMode: { type: String, default: null },
  expanded: { type: Boolean, default: false },
  interactableDoorIds: { type: Array, default: () => [] },
  reachableExitDoors: { type: Array, default: () => [] },
});

defineEmits([
  "room-click",
  "exterior-node-click",
  "door-click",
  "exit-click",
  "select-handle",
  "grid-handle-move",
  "builder-map-click",
  "select-item",
]);
</script>
