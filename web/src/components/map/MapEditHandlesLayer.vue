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
.edit-handle:active {
  cursor: grabbing;
}
</style>
