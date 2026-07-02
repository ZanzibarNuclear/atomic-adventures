<script setup>
defineProps({
  ariaLabel: { type: String, required: true },
  heading: { type: String, required: true },
  markerKeyPrefix: { type: String, required: true },
  markerLines: { type: Array, required: true },
  series: { type: Array, required: true },
  valueLabel: { type: String, required: true },
  showLegend: { type: Boolean, default: false },
});
</script>

<template>
  <section class="graph-card">
    <div class="graph-labels">
      <strong>{{ heading }}</strong>
      <span>{{ valueLabel }}</span>
    </div>
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" :aria-label="ariaLabel">
      <line
        v-for="marker in markerLines"
        :key="`${markerKeyPrefix}:${marker.id}`"
        class="event-marker-line"
        :x1="marker.x"
        y1="3"
        :x2="marker.x"
        y2="37" />
      <polyline
        v-for="item in series"
        :key="item.id"
        :points="item.points"
        :stroke="item.color" />
    </svg>
    <div v-if="showLegend" class="legend">
      <span v-for="item in series" :key="item.id">
        <i :style="{ background: item.color }"></i>{{ item.label }}
      </span>
    </div>
  </section>
</template>
