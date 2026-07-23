<script setup>
import { pointsAttr } from '../../composables/useRoutes.js'

defineProps({
  featurePieces: { type: Array, default: () => [] },
  selectable: { type: Boolean, default: false },
})
defineEmits(['select'])
</script>

<template>
  <g class="feature-layer">
    <polyline
      v-for="(piece, i) in featurePieces"
      :key="'feat-' + i"
      :points="pointsAttr(piece.points)"
      class="feature"
      :class="['feature-' + piece.kind, { stub: piece.partial, selectable }]"
      @click.stop="selectable && $emit('select', piece.id)"
    />
  </g>
</template>

<style scoped>
.feature {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.feature.selectable { pointer-events: stroke; cursor: pointer; }
.feature-stream,
.feature-river {
  stroke: #4a90d9;
  stroke-width: 5;
  opacity: 0.9;
}
.feature-fence {
  stroke: #c9b89a;
  stroke-width: 3;
  stroke-dasharray: 2 6;
}
.feature-road {
  stroke: #8a8073;
  stroke-width: 7;
  opacity: 0.95;
}
.feature-drive {
  stroke: #9b917f;
  stroke-width: 4.5;
}
.feature-road.stub,
.feature-drive.stub {
  opacity: 0.45;
}
</style>
