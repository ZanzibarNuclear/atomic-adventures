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

<style scoped>
.roll-door {
  fill: #8a8073;
  stroke: #5b5247;
  stroke-width: 1;
  pointer-events: none;
  transition: fill 0.25s ease, opacity 0.25s ease;
}
.roll-door.open {
  fill: #3b4658;
  opacity: 0.55;
}
.roll-door.locked {
  stroke: #a0522d;
  stroke-width: 2;
}
.man-door {
  fill: #c39a6b;
  pointer-events: none;
  transition: fill 0.25s ease;
}
.man-door.open {
  fill: #2a3038;
  stroke: #c39a6b;
  stroke-width: 1.5;
}
.man-door.locked {
  stroke: #a0522d;
  stroke-width: 2.5;
}
.man-door.lock-broken {
  stroke: #7a828e;
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
.man-door.door-clickable,
.roll-door.door-clickable {
  pointer-events: all;
  cursor: pointer;
}
.man-door.door-clickable:hover,
.roll-door.door-clickable:hover {
  filter: brightness(1.15);
}
</style>
