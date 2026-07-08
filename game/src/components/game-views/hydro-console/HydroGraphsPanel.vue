<script setup>
import HydroGraphCard from "./HydroGraphCard.vue";

defineProps({
  latestSample: { type: Object, default: null },
  markerLines: { type: Array, required: true },
  powerGraph: { type: Array, required: true },
  pressureSpeedGraph: { type: Array, required: true },
  sampleTimeLabel: { type: Function, required: true },
  telemetry: { type: Object, required: true },
});
</script>

<template>
  <div class="graphs-panel">
    <div class="graphs-header">
      <h2>Live monitor</h2>
      <span>{{ sampleTimeLabel(latestSample) }}</span>
    </div>
    <div class="graph-stack">
      <HydroGraphCard
        aria-label="Power output graph"
        heading="Power output"
        marker-key-prefix="power"
        :marker-lines="markerLines"
        :series="powerGraph"
        :value-label="`${telemetry.generatorOutputKw.toFixed(3)} kW`" />

      <HydroGraphCard
        aria-label="Pressure and turbine speed graph"
        heading="Pressure and turbine speed"
        marker-key-prefix="pressure"
        :marker-lines="markerLines"
        :series="pressureSpeedGraph"
        :value-label="`${telemetry.penstockPressureKpa.toFixed(1)} kPa / ${telemetry.turbineSpeedRpm} rpm`"
        show-legend />
    </div>
  </div>
</template>
