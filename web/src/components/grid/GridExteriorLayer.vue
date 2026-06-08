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
