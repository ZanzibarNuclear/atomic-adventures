<template>
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

  <g v-if="cliffWall" class="cliff-wall-layer" pointer-events="none">
    <path
      v-for="seg in cliffWall.segments"
      :key="'cliff-' + seg.key"
      :d="seg.d"
      class="cliff-wall-fill"
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
</template>

<script setup>
defineProps({
  gridLines: { type: Array, default: () => [] },
  river: { type: Object, default: null },
  cliffWall: { type: Object, default: null },
  buildingShell: { type: Array, default: () => [] },
  beams: { type: Array, default: () => [] },
})

function shellRingPath(ring) {
  if (ring.length === 0) return ''
  return ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
}
</script>
