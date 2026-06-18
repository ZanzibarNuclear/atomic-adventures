<template>
  <g v-if="builderView" class="builder-layer">
    <text
      v-for="hex in allHexes"
      :key="'coord-' + hex.id"
      :x="centerOf(hex).x"
      :y="centerOf(hex).y"
      class="builder-coord"
    >
      ({{ hex.q }}, {{ hex.r }})
    </text>
  </g>
</template>

<script setup>
defineProps({
  builderView: { type: Boolean, default: false },
  allHexes: { type: Array, default: () => [] },
  centerOf: { type: Function, required: true },
})
</script>

<style scoped>
.builder-layer {
  pointer-events: none;
}
.builder-coord {
  fill: #ffe08a;
  font-size: 9px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.65);
  stroke-width: 3px;
}
</style>
