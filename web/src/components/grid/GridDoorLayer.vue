<template>
  <g class="door-layer">
    <rect
      v-for="d in doors"
      :key="d.id"
      :x="d.x"
      :y="d.y"
      :width="d.w"
      :height="d.h"
      :class="[
        d.kind === 'roll' ? 'roll-door' : 'man-door',
        {
          open: d.open,
          closed: !d.open,
          locked: d.locked,
          'lock-broken': d.lockBroken,
          'door-clickable': interactableDoorIds.has(d.id) || builderView,
          'builder-selected': isItemSelected(d.id),
        },
      ]"
      @click.stop="$emit('door-click', d.id)"
    />
  </g>
</template>

<script setup>
defineProps({
  doors: { type: Array, default: () => [] },
  interactableDoorIds: { type: Object, required: true },
  builderView: { type: Boolean, default: false },
  isItemSelected: { type: Function, required: true },
})

defineEmits(['door-click'])
</script>
