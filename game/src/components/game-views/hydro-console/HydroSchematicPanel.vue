<script setup>
defineProps({
  fieldChecks: { type: Array, required: true },
  statusLabel: { type: String, required: true },
  telemetry: { type: Object, required: true },
});
</script>

<template>
  <div class="schematic-panel">
    <div class="status-strip">
      <span>Status</span>
      <strong>{{ statusLabel }}</strong>
    </div>
    <div class="plant-line" aria-hidden="true">
      <span class="node water">Intake</span>
      <span class="pipe" :class="{ active: telemetry.flowM3s > 0 }"></span>
      <span class="node turbine">Turbine</span>
      <span class="pipe" :class="{ active: telemetry.generatorOutputKw > 0 }"></span>
      <span class="node power">Station</span>
    </div>
    <div class="field-checks">
      <span
        v-for="check in fieldChecks"
        :key="check.id"
        class="check"
        :class="{ ok: check.ok }">
        {{ check.label }}
      </span>
    </div>
  </div>
</template>
