<template>
  <g v-if="river" class="river-layer" pointer-events="none">
    <rect
      :x="river.rect.x"
      :y="river.rect.y"
      :width="river.rect.w"
      :height="river.rect.h"
      class="river-fill"
    />
    <path
      v-for="(d, i) in river.chevrons"
      :key="'river-flow-' + i"
      :d="d"
      class="river-flow"
    />
  </g>

  <g
    v-if="cliffWall"
    class="cliff-wall-layer"
    :class="{ selectable: builderView }"
    :pointer-events="builderView ? 'auto' : 'none'"
  >
    <path
      v-for="seg in cliffWall.segments"
      :key="'cliff-' + seg.key"
      :d="seg.d"
      class="cliff-wall-fill"
      @click.stop="builderView && $emit('select-item', { source: 'fixtures', id: 'cliff-wall' })"
    />
  </g>

  <g v-if="buildingShell.length" class="building-shell-layer" pointer-events="none">
    <path
      v-for="(ring, i) in buildingShell"
      :key="'shell-' + i"
      :d="shellRingPath(ring)"
      class="building-shell"
      pointer-events="none"
    />
  </g>

  <g class="beam-layer">
    <g v-for="(b, i) in beams" :key="'beam-' + i">
      <line :x1="b.x1" :y1="b.y1" :x2="b.x2" :y2="b.y2" class="beam" />
      <rect
        v-for="(col, j) in b.columns"
        :key="'col-' + i + '-' + j"
        :x="col.x - 4"
        :y="col.y - 4"
        width="8"
        height="8"
        class="column"
      />
    </g>
  </g>

  <g class="grid-layer">
    <line
      v-for="(ln, i) in gridLines"
      :key="'grid-' + i"
      :x1="ln.x1"
      :y1="ln.y1"
      :x2="ln.x2"
      :y2="ln.y2"
      class="grid-line"
    />
  </g>
</template>

<script setup>
defineProps({
  gridLines: { type: Array, default: () => [] },
  river: { type: Object, default: null },
  cliffWall: { type: Object, default: null },
  buildingShell: { type: Array, default: () => [] },
  beams: { type: Array, default: () => [] },
  builderView: { type: Boolean, default: false },
})

defineEmits(['select-item'])

function shellRingPath(ring) {
  if (ring.length === 0) return ''
  return ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
}
</script>

<style scoped>
.grid-layer {
  pointer-events: none;
}
.grid-line {
  stroke: rgba(255, 255, 255, 0.16);
  stroke-width: 1;
}
.building-shell-layer {
  pointer-events: none;
}
.river-layer {
  pointer-events: none;
}
.river-fill {
  fill: #2a5578;
  opacity: 0.92;
}
.river-flow {
  fill: none;
  stroke: rgba(200, 230, 255, 0.5);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cliff-wall-layer {
  pointer-events: none;
}
.cliff-wall-layer.selectable {
  pointer-events: auto;
  cursor: pointer;
}
.cliff-wall-fill {
  fill: url(#cliff-wall-stone);
  stroke: #5c5854;
  stroke-width: 2;
  stroke-linejoin: bevel;
  pointer-events: visiblePainted;
}
.building-shell {
  fill: #14181f;
  stroke: rgba(255, 255, 255, 0.22);
  stroke-width: 2.5;
}
.beam {
  stroke: #6f6657;
  stroke-width: 5;
  stroke-linecap: round;
  opacity: 0.85;
  pointer-events: none;
}
.column {
  fill: #514a3f;
  pointer-events: none;
}
</style>
