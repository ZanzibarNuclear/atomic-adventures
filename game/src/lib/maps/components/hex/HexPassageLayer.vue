<template>
  <g class="passage-layer">
    <g
      v-for="m in passageMarkers"
      :key="'passage-' + m.id"
      class="passage"
      :class="'passage-' + m.kind"
    >
      <!-- Gate: guard booth -->
      <g v-if="m.kind === 'gate'" :transform="`translate(${m.x}, ${m.y})`">
        <rect x="-6.5" y="-8" width="13" height="8" rx="1" class="gate-wall" />
        <polygon points="-7.5,-8 7.5,-8 0,-11.5" class="gate-roof" />
        <rect x="-2.5" y="-6" width="5" height="3.5" rx="0.4" class="gate-window" />
      </g>

      <!-- Hole: gap in fence -->
      <g v-else-if="m.kind === 'hole'" :transform="`translate(${m.x}, ${m.y})`">
        <line x1="0" y1="-7" x2="0" y2="7" class="hole-gap" />
        <path d="M -5 -4 L -2 -4 M 2 -4 L 5 -4 M -5 4 L -2 4 M 2 4 L 5 4" class="hole-wire" />
      </g>

      <!-- Ford: shallow stones -->
      <g v-else-if="m.kind === 'ford'" :transform="`translate(${m.x}, ${m.y})`">
        <ellipse cx="0" cy="2" rx="9" ry="4" class="ford-pool" />
        <circle cx="-4" cy="0" r="1.8" class="ford-stone" />
        <circle cx="0" cy="-1" r="1.6" class="ford-stone" />
        <circle cx="4" cy="0" r="1.7" class="ford-stone" />
        <path d="M -6 4 Q -3 6 0 5 Q 3 6 6 4" class="ford-ripple" />
      </g>

      <!-- Bridge: simple arch span -->
      <g v-else-if="m.kind === 'bridge'" :transform="`translate(${m.x}, ${m.y})`">
        <path d="M -10 2 Q 0 -8 10 2" class="bridge-arch" />
        <line x1="-10" y1="2" x2="10" y2="2" class="bridge-deck" />
        <line x1="-8" y1="2" x2="-8" y2="5" class="bridge-pier" />
        <line x1="8" y1="2" x2="8" y2="5" class="bridge-pier" />
      </g>

      <text :x="m.labelX" :y="m.labelY" class="passage-label">{{ m.label }}</text>
    </g>
  </g>
</template>

<script setup>
defineProps({
  passageMarkers: { type: Array, default: () => [] },
})
</script>

<style scoped>
.passage-layer {
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
.hole-gap {
  stroke: #2a2724;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.hole-wire {
  stroke: #6b6358;
  stroke-width: 1.2;
  fill: none;
  stroke-linecap: round;
}
.ford-pool {
  fill: rgba(74, 144, 184, 0.35);
  stroke: #3a6a8a;
  stroke-width: 0.8;
}
.ford-stone {
  fill: #8a8478;
  stroke: #4a4540;
  stroke-width: 0.6;
}
.ford-ripple {
  fill: none;
  stroke: #5a9ab8;
  stroke-width: 0.8;
  opacity: 0.7;
}
.bridge-arch {
  fill: none;
  stroke: #6b6358;
  stroke-width: 1.4;
}
.bridge-deck {
  stroke: #5a5548;
  stroke-width: 2.2;
  stroke-linecap: round;
}
.bridge-pier {
  stroke: #4a4540;
  stroke-width: 1.4;
  stroke-linecap: round;
}
.passage-label {
  fill: #f4f1de;
  font-size: 10px;
  text-anchor: middle;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgba(0, 0, 0, 0.55);
  stroke-width: 3px;
}
</style>
