<template>
  <g class="gate-layer">
    <g v-for="g in gateMarkers" :key="'gate-' + g.id" class="gate">
      <g class="gate-booth" :transform="`translate(${g.x}, ${g.y})`">
        <rect x="-6.5" y="-8" width="13" height="8" rx="1" class="gate-wall" />
        <polygon points="-7.5,-8 7.5,-8 0,-11.5" class="gate-roof" />
        <rect x="-2.5" y="-6" width="5" height="3.5" rx="0.4" class="gate-window" />
      </g>
      <text :x="g.labelX" :y="g.labelY" class="gate-label">{{ g.name }}</text>
    </g>
  </g>
</template>

<script setup>
defineProps({
  gateMarkers: { type: Array, default: () => [] },
})
</script>

<style scoped>
.gate-layer {
  pointer-events: none;
}
.gate-wall {
  fill: #6b6358;
  stroke: #3d3832;
  stroke-width: 1.2;
}
.gate-roof {
  fill: #4a4540;
  stroke: #2a2724;
  stroke-width: 1;
  stroke-linejoin: round;
}
.gate-window {
  fill: #8ec8e8;
  stroke: #3d3832;
  stroke-width: 0.8;
  opacity: 0.85;
}
.gate-label {
  fill: #f4f1de;
  font-size: 10px;
  text-anchor: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 3px;
}
</style>
