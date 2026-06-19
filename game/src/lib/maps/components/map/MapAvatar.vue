<template>
  <g
    v-if="visible"
    class="map-avatar"
    :class="{ instant }"
    :style="{ transform: `translate(${x}px, ${y}px)` }"
  >
    <circle
      v-if="halo"
      :cx="0"
      :cy="1 * scale"
      :r="37.5 * scale"
      class="map-avatar-halo"
    />
    <ellipse
      :cx="0"
      :cy="27 * scale"
      :rx="13 * scale"
      :ry="3.5 * scale"
      class="map-avatar-shadow"
    />
    <g :transform="`scale(${scale})`" class="map-avatar-figure">
      <circle cx="0" cy="-24" r="7.5" />
      <line x1="0" y1="-16.5" x2="0" y2="6" />
      <line x1="-13" y1="-6" x2="13" y2="-6" />
      <line x1="0" y1="6" x2="-10" y2="26" />
      <line x1="0" y1="6" x2="10" y2="26" />
    </g>
  </g>
</template>

<script setup>
defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  scale: { type: Number, required: true },
  visible: { type: Boolean, default: true },
  halo: { type: Boolean, default: false },
  instant: { type: Boolean, default: false },
})
</script>

<style scoped>
.map-avatar {
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
.map-avatar.instant {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .map-avatar {
    transition: none;
  }
}
.map-avatar-shadow {
  fill: rgba(0, 0, 0, 0.28);
}
.map-avatar-halo {
  fill: #ffd166;
  stroke: #c9970a;
  stroke-width: 1.5;
}
.map-avatar-figure circle {
  fill: #f4f1de;
  stroke: #1c2620;
  stroke-width: 4;
}
.map-avatar-figure line {
  stroke: #1c2620;
  stroke-width: 5;
  stroke-linecap: round;
}
</style>
