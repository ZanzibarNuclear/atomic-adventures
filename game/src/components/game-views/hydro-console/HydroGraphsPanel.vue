<script setup>
import HydroGraphCard from "./HydroGraphCard.vue";

defineProps({
  markerLines: { type: Array, required: true },
  powerGraph: { type: Array, required: true },
  pressureGraph: { type: Array, required: true },
  speedGraph: { type: Array, required: true },
  telemetry: { type: Object, required: true },
});
</script>

<template>
  <div class="graphs-panel">
    <div class="graphs-header">
      <h2>Live monitor</h2>
    </div>
    <div class="graph-stack graph-stack-triple">
      <HydroGraphCard
        aria-label="Power output graph"
        heading="Power output"
        marker-key-prefix="power"
        :marker-lines="markerLines"
        :series="powerGraph"
        :value-label="`${Number(telemetry.generatorOutputKw ?? 0).toFixed(3)} kW`" />

      <HydroGraphCard
        aria-label="Water pressure graph"
        heading="Water pressure"
        marker-key-prefix="pressure"
        :marker-lines="markerLines"
        :series="pressureGraph"
        :value-label="`${Number(telemetry.penstockPressureKpa ?? 0).toFixed(1)} kPa`" />

      <HydroGraphCard
        aria-label="Turbine speed graph"
        heading="Turbine speed"
        marker-key-prefix="speed"
        :marker-lines="markerLines"
        :series="speedGraph"
        :value-label="`${telemetry.turbineSpeedRpm ?? 0} rpm`" />
    </div>
  </div>
</template>
