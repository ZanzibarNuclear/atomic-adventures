<template>
  <g v-if="visible" class="edit-layer">
    <slot name="overlay" />
    <circle
      v-for="h in handles"
      :key="'handle-' + h.handleKey"
      :cx="h.x"
      :cy="h.y"
      :r="radiusFor(h)"
      class="edit-handle"
      :class="{
        selected: h.handleKey === selectedHandleId,
        ['role-' + h.role]: !!h.role,
        'path-node-handle': h.role === 'path-node',
      }"
      :style="{ stroke: strokeColor(h), fill: fillColor(h) }"
      @pointerdown="$emit('handle-down', $event, h)"
    />
  </g>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: true },
  handles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  strokeColor: { type: Function, required: true },
  fillColor: { type: Function, required: true },
  handleRadius: { type: Function, default: null },
})

defineEmits(['handle-down'])

function radiusFor(h) {
  if (props.handleRadius) return props.handleRadius(h)
  return h.handleKey === props.selectedHandleId ? 7 : 5.5
}
</script>

<style scoped>
.edit-layer {
  pointer-events: all;
}
.edit-guide {
  fill: none;
  stroke-width: 2;
  stroke-dasharray: 4 5;
  opacity: 0.85;
  pointer-events: none;
}
.edit-path-control {
  fill: none;
  stroke: #58c4e8;
  stroke-width: 2.5;
  stroke-dasharray: 6 5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.95;
  pointer-events: none;
}
.room-selection-outline {
  fill: rgba(200, 162, 255, 0.08);
  stroke: rgba(200, 162, 255, 0.75);
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}
.edit-handle {
  stroke-width: 2.5;
  cursor: grab;
  touch-action: none;
}
.edit-handle.selected {
  stroke-width: 3;
}
.edit-handle.path-node-handle {
  stroke-width: 3;
}
.edit-handle.path-node-handle.selected {
  stroke-width: 3.5;
}
.edit-handle:active {
  cursor: grabbing;
}
</style>
