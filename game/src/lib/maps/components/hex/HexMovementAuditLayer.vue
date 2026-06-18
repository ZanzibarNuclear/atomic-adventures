<template>
  <g v-if="entries.length" class="movement-audit-layer">
    <g
      v-for="entry in entries"
      :key="entry.id"
      class="audit-move"
      :class="`audit-${entry.status}`"
    >
      <polyline
        v-if="entry.path?.length > 1"
        :points="points(entry.path)"
        class="audit-path"
      />
      <line
        v-else
        :x1="entry.from.x"
        :y1="entry.from.y"
        :x2="entry.stand?.x ?? entry.from.x"
        :y2="entry.stand?.y ?? entry.from.y"
        class="audit-path"
      />
      <circle
        :cx="entry.stand?.x ?? entry.from.x"
        :cy="entry.stand?.y ?? entry.from.y"
        r="3.2"
        class="audit-stand"
      />
      <text
        :x="(entry.stand?.x ?? entry.from.x) + 4"
        :y="(entry.stand?.y ?? entry.from.y) - 4"
        class="audit-label"
      >
        {{ entry.toHexId }}
      </text>
    </g>
  </g>
</template>

<script setup>
defineProps({
  entries: { type: Array, default: () => [] },
})

function points(path) {
  return path.map((point) => `${point.x},${point.y}`).join(' ')
}
</script>

<style scoped>
.movement-audit-layer {
  pointer-events: none;
}
.audit-path {
  fill: none;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.82;
}
.audit-stand {
  stroke: #101510;
  stroke-width: 1;
}
.audit-label {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 5px;
  font-weight: 700;
  paint-order: stroke;
  stroke: rgba(10, 14, 10, 0.9);
  stroke-width: 1.8px;
}
.audit-valid .audit-path {
  stroke: #68e391;
}
.audit-valid .audit-stand {
  fill: #68e391;
}
.audit-valid .audit-label {
  fill: #caffd7;
}
.audit-blocked .audit-path {
  stroke: #9ca69d;
  stroke-dasharray: 3 3;
  opacity: 0.45;
}
.audit-blocked .audit-stand {
  fill: #9ca69d;
  opacity: 0.65;
}
.audit-blocked .audit-label {
  fill: #cbd1cc;
}
.audit-invalid .audit-path {
  stroke: #ff5d5d;
  stroke-width: 2.4;
}
.audit-invalid .audit-stand {
  fill: #ff5d5d;
}
.audit-invalid .audit-label {
  fill: #ffd1d1;
}
</style>
