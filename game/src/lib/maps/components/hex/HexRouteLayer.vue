<script setup>
import { pointsAttr } from '../../composables/useRoutes.js'

defineProps({
  routePieces: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
})
defineEmits(['select'])
</script>

<template>
  <g class="routes-layer">
    <polyline
      v-for="(piece, i) in routePieces"
      :key="'piece-' + i"
      :points="pointsAttr(piece.points)"
      class="route"
      :class="['route-' + piece.kind, { stub: piece.partial, selectable }]"
      @click.stop="selectable && $emit('select', piece.id)"
    />
  </g>
</template>

<style scoped>
.route {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.route.selectable { pointer-events: stroke; cursor: pointer; }
.route-path {
  stroke: #7a4f2a;
  stroke-width: 3;
  stroke-dasharray: 2.5 5;
}
.route-road {
  stroke: #6b6f76;
  stroke-width: 6;
}
.route-drive {
  stroke: #9b917f;
  stroke-width: 4.5;
}
.route-trail {
  stroke: #c9b97e;
  stroke-width: 2.5;
  stroke-dasharray: 1.5 6;
}
.route.stub {
  opacity: 0.45;
}
</style>
