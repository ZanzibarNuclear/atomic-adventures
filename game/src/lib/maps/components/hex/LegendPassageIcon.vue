<template>
  <svg class="legend-passage" viewBox="-11 -8 22 16" aria-hidden="true">
    <g v-if="kind === 'gate'">
      <path
        d="M -5 -3 L -2 -3 M 2 -3 L 5 -3 M -5 3 L -2 3 M 2 3 L 5 3"
        class="fence-wire"
      />
      <line x1="-6" y1="0" x2="6" y2="0" class="gap" />
      <rect x="-4.5" y="-1.5" width="9" height="3" rx="0.3" class="panel" />
    </g>

    <g v-else-if="kind === 'hole'">
      <line x1="0" y1="-6" x2="0" y2="6" class="gap" />
      <path
        d="M -4.5 -3 L -2 -3 M 2 -3 L 4.5 -3 M -4.5 3 L -2 3 M 2 3 L 4.5 3"
        class="fence-wire"
      />
    </g>

    <g v-else-if="kind === 'ford'">
      <ellipse cx="0" cy="2" rx="7" ry="3" class="pool" />
      <circle cx="-3" cy="0" r="1.3" class="stone" />
      <circle cx="0" cy="-1" r="1.1" class="stone" />
      <circle cx="3" cy="0" r="1.2" class="stone" />
    </g>

    <g v-else-if="kind === 'bridge'">
      <path d="M -8 1.5 Q 0 -6 8 1.5" class="arch" />
      <line x1="-8" y1="1.5" x2="8" y2="1.5" class="deck" />
      <line x1="-6.5" y1="1.5" x2="-6.5" y2="4" class="pier" />
      <line x1="6.5" y1="1.5" x2="6.5" y2="4" class="pier" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  kind: { type: String, required: true },
})
</script>

<style scoped>
.legend-passage {
  width: 18px;
  height: 14px;
  flex: 0 0 auto;
}
.fence-wire {
  stroke: #6b6358;
  stroke-width: 1;
  fill: none;
  stroke-linecap: round;
}
.gap {
  stroke: #2a2724;
  stroke-width: 2;
  stroke-linecap: round;
}
.panel {
  fill: #6b6358;
  stroke: #3d3832;
  stroke-width: 0.8;
}
.pool {
  fill: rgba(74, 144, 184, 0.35);
  stroke: #3a6a8a;
  stroke-width: 0.7;
}
.stone {
  fill: #8a8478;
  stroke: #4a4540;
  stroke-width: 0.5;
}
.arch {
  fill: none;
  stroke: #6b6358;
  stroke-width: 1.2;
}
.deck {
  stroke: #5a5548;
  stroke-width: 1.8;
  stroke-linecap: round;
}
.pier {
  stroke: #4a4540;
  stroke-width: 1.1;
  stroke-linecap: round;
}
</style>
