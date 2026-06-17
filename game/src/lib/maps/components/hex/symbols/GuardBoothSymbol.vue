<template>
  <g class="guard-booth" aria-hidden="true">
    <rect x="-6.5" y="-8" width="13" height="8" rx="1" class="booth-wall" />
    <polygon points="-7.5,-8 7.5,-8 0,-11.5" class="booth-roof" />
    <rect x="-2.5" y="-6" width="5" height="3.5" rx="0.4" class="booth-window" />
  </g>
</template>

<style scoped>
.booth-wall {
  fill: #6b6358;
  stroke: #3d3832;
  stroke-width: 1.2;
}
.booth-roof {
  fill: #4a4540;
  stroke: #2a2724;
  stroke-width: 1;
  stroke-linejoin: round;
}
.booth-window {
  fill: #8ec8e8;
  stroke: #3d3832;
  stroke-width: 0.8;
  opacity: 0.85;
}
</style>
