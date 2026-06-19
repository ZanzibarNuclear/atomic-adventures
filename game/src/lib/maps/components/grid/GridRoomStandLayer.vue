<template>
  <g class="room-stand-layer">
    <g
      v-for="stand in stands"
      :key="stand.key"
      class="room-stand"
      :class="{
        current: stand.current,
        derived: stand.kind === 'door',
        reachable: stand.reachable,
        'builder-selected': stand.selected,
      }"
      @click.stop="$emit('stand-click', stand.roomId, stand.id)"
    >
      <circle :cx="stand.cx" :cy="stand.cy" :r="stand.r" class="stand-dot" />
      <circle v-if="stand.current" :cx="stand.cx" :cy="stand.cy" :r="stand.r + 3" class="stand-ring" />
      <text
        v-if="stand.current || stand.reachable || builderView"
        :x="stand.cx"
        :y="stand.cy + stand.r + 5"
        class="stand-label"
      >{{ stand.label }}</text>
    </g>
  </g>
</template>

<script setup>
defineProps({
  stands: { type: Array, default: () => [] },
  builderView: { type: Boolean, default: false },
})
defineEmits(['stand-click'])
</script>

<style scoped>
.room-stand { opacity: .48; pointer-events: all; cursor: pointer; }
.room-stand.reachable { opacity: .9; }
.room-stand.current { opacity: 1; }
.stand-dot { fill: #6d83a1; stroke: #d7e2f1; stroke-width: 1.5; }
.room-stand.derived .stand-dot {
  fill: #806e55;
  stroke: #e4c88f;
  stroke-dasharray: 2 2;
}
.room-stand.builder-selected .stand-dot { stroke: #d7a8ff; stroke-width: 3; }
.stand-ring { fill: none; stroke: rgba(220, 235, 255, .72); stroke-width: 1.5; }
.stand-label {
  fill: #dfe8f5;
  font-size: 7px;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: hanging;
  paint-order: stroke;
  stroke: rgba(20, 24, 30, .9);
  stroke-width: 2px;
  pointer-events: none;
}
</style>
