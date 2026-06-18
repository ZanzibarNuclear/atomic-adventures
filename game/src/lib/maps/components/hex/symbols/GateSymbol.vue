<template>
  <!-- Fence runs along local +X; gate opening is a break in that line (like the hole). -->
  <g class="gate-symbol" :class="open ? 'gate-open' : 'gate-closed'" aria-hidden="true">
    <path
      d="M -5 -4 L -2 -4 M 2 -4 L 5 -4 M -5 4 L -2 4 M 2 4 L 5 4"
      class="fence-wire"
    />

    <g v-if="!open">
      <line x1="-7" y1="0" x2="7" y2="0" class="gate-gap" />
      <rect x="-5.5" y="-2" width="11" height="4" rx="0.3" class="gate-panel" />
      <line x1="-3.5" y1="-2" x2="-3.5" y2="2" class="gate-bar" />
      <line x1="-0.8" y1="-2" x2="-0.8" y2="2" class="gate-bar" />
      <line x1="1.8" y1="-2" x2="1.8" y2="2" class="gate-bar" />
      <circle cx="4.5" cy="0" r="1.1" class="gate-latch" />
    </g>

    <g v-else>
      <line x1="-7" y1="0" x2="-1" y2="0" class="gate-gap" />
      <line x1="-5" y1="0" x2="4" y2="-3.5" class="gate-leaf" />
    </g>
  </g>
</template>

<script setup>
defineProps({
  /** When true, gate leaf is swung open along the fence. */
  open: { type: Boolean, default: true },
})
</script>

<style scoped>
.fence-wire {
  stroke: #6b6358;
  stroke-width: 1.2;
  fill: none;
  stroke-linecap: round;
}
.gate-gap {
  stroke: #2a2724;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.gate-panel {
  fill: #6b6358;
  stroke: #3d3832;
  stroke-width: 1;
}
.gate-bar {
  stroke: #4a4540;
  stroke-width: 0.7;
}
.gate-latch {
  fill: #8a8073;
  stroke: #4a4540;
  stroke-width: 0.6;
}
.gate-leaf {
  stroke: #5a5548;
  stroke-width: 2.2;
  stroke-linecap: round;
}
</style>
