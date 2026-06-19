<template>
  <g v-if="visible" class="edit-layer">
    <slot name="overlay" />
    <g
      v-for="h in handles"
      :key="'handle-' + h.handleKey"
    >
      <title>{{ handleLabel(h) }}</title>
      <circle
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

function handleLabel(h) {
  if (h.role === 'move') return 'Move room'
  if (['nw', 'ne', 'se', 'sw'].includes(h.role)) return 'Resize room'
  if (h.role === 'point') return 'Move path waypoint'
  if (h.role === 'path-node') return 'Move path stand node'
  if (h.role === 'door-at') return 'Move door'
  if (h.role === 'node-at') return 'Move exterior node'
  if (h.role === 'room-stand') return 'Move room stand'
  if (h.role === 'exit-map') return 'Move world transition'
  return 'Move geometry'
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
  vector-effect: non-scaling-stroke;
}
.edit-handle {
  stroke-width: 2.5;
  cursor: move;
  touch-action: none;
  vector-effect: non-scaling-stroke;
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
  cursor: move;
}
</style>
