<template>
  <g class="exterior-path-layer">
    <polyline
      v-for="path in paths"
      :key="'ext-path-' + path.id"
      :points="path.points"
      class="exterior-path"
      :class="{
        'exterior-path-builder-dim': path.dimmed,
        'exterior-path-builder-active': path.isSelected,
      }"
    />
  </g>

  <g class="exterior-node-layer">
    <g
      v-for="node in nodes"
      :key="'ext-node-' + node.id"
      class="exterior-node"
      :class="{
        current: node.current,
        reachable: node.reachable || builderView,
        'builder-selected': isItemSelected(node.id),
      }"
      @click.stop="$emit('exterior-node-click', node.id)"
    >
      <circle :cx="node.cx" :cy="node.cy" :r="node.r" class="exterior-node-fill" />
      <circle
        v-if="node.current"
        :cx="node.cx"
        :cy="node.cy"
        :r="node.r + 4"
        class="exterior-node-ring"
      />
      <text
        v-if="node.current || node.reachable"
        :x="node.cx"
        :y="node.cy - node.r - 6"
        class="exterior-node-label"
      >
        {{ node.label }}
      </text>
    </g>
  </g>

  <g class="exit-layer">
    <g
      v-for="ex in exits"
      :key="'exit-' + ex.doorId"
      class="exit-hex"
      :class="{
        reachable: ex.reachable,
        playable: !builderView,
        'builder-selected': isItemSelected(ex.doorId),
        'builder-pick': builderView,
      }"
      @click.stop="$emit('exit-click', $event, ex.doorId)"
    >
      <polygon :points="ex.points" class="exit-hex-fill" />
      <text :x="ex.cx" :y="ex.cy + 1" class="exit-hex-icon">⬡</text>
      <text :x="ex.cx" :y="ex.cy + 14" class="exit-hex-label">map</text>
    </g>
  </g>
</template>

<script setup>
defineProps({
  paths: { type: Array, default: () => [] },
  nodes: { type: Array, default: () => [] },
  exits: { type: Array, default: () => [] },
  builderView: { type: Boolean, default: false },
  isItemSelected: { type: Function, required: true },
})

defineEmits(['exterior-node-click', 'exit-click'])
</script>

<style scoped>
.exterior-path {
  fill: none;
  stroke: #c9b97e;
  stroke-width: 2.8;
  stroke-dasharray: 1.5 6;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.82;
  pointer-events: none;
}
.exterior-path-builder-dim {
  stroke: #5c574e;
  stroke-width: 2;
  stroke-dasharray: 2 8;
  opacity: 0.45;
}
.exterior-path-builder-active {
  stroke: #e878a8;
  stroke-width: 3.5;
  stroke-dasharray: none;
  opacity: 0.95;
}
.exterior-node {
  pointer-events: none;
  opacity: 0.4;
}
.exterior-node.reachable {
  pointer-events: all;
  cursor: pointer;
  opacity: 0.9;
}
.exterior-node.current {
  opacity: 1;
}
.exterior-node-fill {
  fill: #5c7058;
  stroke: #c9b97e;
  stroke-width: 2;
  transition: fill 0.2s ease, stroke 0.2s ease;
}
.exterior-node-ring {
  fill: none;
  stroke: rgba(224, 212, 168, 0.55);
  stroke-width: 2;
  pointer-events: none;
}
.exterior-node-label {
  fill: #e0d4a8;
  font-size: 8px;
  font-weight: 600;
  text-anchor: middle;
  pointer-events: none;
}
.exterior-node.reachable:hover .exterior-node-fill {
  fill: #6a8066;
  stroke: #e0d4a8;
}
.exterior-node.current .exterior-node-fill {
  fill: #7a9474;
  stroke: #fff;
  stroke-width: 2.5;
}
.exterior-node.builder-selected .exterior-node-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 3;
}
.exit-hex {
  pointer-events: none;
  opacity: 0.45;
}
.exit-hex.playable,
.exit-hex.builder-pick {
  pointer-events: all;
  cursor: pointer;
}
.exit-hex.reachable {
  opacity: 1;
}
.exit-hex.playable:not(.reachable) {
  opacity: 0.55;
  cursor: not-allowed;
}
.exit-hex-fill {
  fill: #3d5a4a;
  stroke: #8ab89a;
  stroke-width: 1.5;
  transition: fill 0.2s ease, stroke 0.2s ease;
}
.exit-hex.reachable:hover .exit-hex-fill {
  fill: #4a7560;
  stroke: #b8e0c8;
}
.exit-hex.builder-selected .exit-hex-fill {
  stroke: rgba(200, 162, 255, 0.95);
  stroke-width: 2.5;
}
.exit-hex-icon {
  fill: #c8e6d0;
  font-size: 11px;
  text-anchor: middle;
  pointer-events: none;
  opacity: 0.85;
}
.exit-hex-label {
  fill: #9ab89a;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-anchor: middle;
  pointer-events: none;
}
</style>
