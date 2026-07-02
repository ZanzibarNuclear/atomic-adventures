<script setup>
defineProps({
  report: { type: Object, required: true },
});
</script>

<template>
  <div class="report-panel">
    <h2>Last report</h2>
    <dl>
      <div>
        <dt>Average output</dt>
        <dd>{{ report.averageOutputKw.toFixed(3) }} kW</dd>
      </div>
      <div>
        <dt>Generated energy</dt>
        <dd>{{ report.generatedEnergyKwh.toFixed(3) }} kWh</dd>
      </div>
      <div>
        <dt>Brownout time</dt>
        <dd>{{ Math.round(report.brownoutMinutes) }} min</dd>
      </div>
      <div>
        <dt>Latest warning</dt>
        <dd>{{ report.latestWarning ?? "None" }}</dd>
      </div>
    </dl>
  </div>
</template>
