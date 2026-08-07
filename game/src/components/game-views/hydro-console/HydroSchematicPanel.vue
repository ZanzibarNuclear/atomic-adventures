<script setup>
defineProps({
  diagnostics: { type: Array, required: true },
  fieldChecks: { type: Array, required: true },
  guidedActions: { type: Array, required: true },
  statusLabel: { type: String, required: true },
  telemetry: { type: Object, required: true },
});

defineEmits(["return-to-map"]);
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
    <section class="console-guidance" aria-label="Console guidance">
      <div>
        <h2>Diagnostics</h2>
        <p v-if="!diagnostics.length" class="quiet">No notes, warnings, or faults.</p>
        <ul v-else>
          <li
            v-for="item in diagnostics"
            :key="`${item.kind}:${item.id}`"
            :class="`diag-${String(item.kind).toLowerCase()}`">
            <strong>{{ item.kind }}</strong>
            <span>{{ item.label }}</span>
          </li>
        </ul>
      </div>
      <div v-if="guidedActions.length" class="guided-actions">
        <h2>Next action</h2>
        <div v-for="action in guidedActions" :key="action.id" class="guided-action">
          <strong>{{ action.title }}</strong>
          <span>{{ action.body }}</span>
          <button type="button" @click="$emit('return-to-map')">Return to map</button>
        </div>
      </div>
    </section>
  </div>
</template>
