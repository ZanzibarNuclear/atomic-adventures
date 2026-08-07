<script setup>
defineProps({
  equipment: { type: Object, required: true },
  guidedActions: { type: Array, required: true },
  telemetry: { type: Object, required: true },
});

defineEmits(["return-to-map"]);
</script>

<template>
  <div class="schematic-panel">
    <div class="plant-schematic" aria-label="Hydro power path">
      <!-- Intake + stacked field badges -->
      <div class="equip-column">
        <div class="node water">Intake</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.intakeClear.ok }">
            {{ equipment.intakeClear.label }}
          </span>
          <span class="check" :class="{ ok: equipment.intakeOpen.ok }">
            {{ equipment.intakeOpen.label }}
          </span>
        </div>
      </div>

      <span class="pipe" :class="{ active: equipment.pathToBypass }" aria-hidden="true"></span>

      <!-- Bypass valve (step 3): Open = cascade; Closed = penstock to turbine -->
      <div class="equip-column">
        <div class="node bypass">Bypass</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.bypass.ok }">
            {{ equipment.bypass.label }}
          </span>
        </div>
      </div>

      <span class="pipe" :class="{ active: equipment.pathToTurbine }" aria-hidden="true"></span>

      <!-- Turbine + penstock valve -->
      <div class="equip-column">
        <div class="node turbine">Turbine</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.turbineValve.ok }">
            {{ equipment.turbineValve.label }}
          </span>
        </div>
      </div>

      <span class="pipe" :class="{ active: equipment.pathToGenerator }" aria-hidden="true"></span>

      <!-- Generator engagement -->
      <div class="equip-column">
        <div class="node generator">Generator</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.generator.ok }">
            {{ equipment.generator.label }}
          </span>
        </div>
      </div>

      <span class="pipe" :class="{ active: equipment.pathToGrid }" aria-hidden="true"></span>

      <!-- Station bus / grid -->
      <div class="equip-column">
        <div class="node grid">Grid</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.grid.ok }">
            {{ equipment.grid.label }}
          </span>
        </div>
      </div>
    </div>

    <section
      v-if="guidedActions.length"
      class="console-guidance console-guidance-single"
      aria-label="Next field action">
      <div class="guided-actions">
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
