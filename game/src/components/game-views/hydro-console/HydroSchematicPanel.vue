<script setup>
defineProps({
  equipment: { type: Object, required: true },
  telemetry: { type: Object, required: true },
});
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

      <div class="pipe-slot" aria-hidden="true">
        <span class="pipe" :class="{ active: equipment.pathToBypass }"></span>
      </div>

      <!-- Bypass: Open = cascade; Closed = penstock to turbine -->
      <div class="equip-column">
        <div class="node bypass">Bypass</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.bypass.ok }">
            {{ equipment.bypass.label }}
          </span>
        </div>
      </div>

      <div class="pipe-slot" aria-hidden="true">
        <span class="pipe" :class="{ active: equipment.pathToTurbine }"></span>
      </div>

      <!-- Turbine + penstock valve -->
      <div class="equip-column">
        <div class="node turbine">Turbine</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.turbineValve.ok }">
            {{ equipment.turbineValve.label }}
          </span>
        </div>
      </div>

      <div class="pipe-slot" aria-hidden="true">
        <span class="pipe" :class="{ active: equipment.pathToGenerator }"></span>
      </div>

      <!-- Generator engagement -->
      <div class="equip-column">
        <div class="node generator">Generator</div>
        <div class="badge-stack">
          <span class="check" :class="{ ok: equipment.generator.ok }">
            {{ equipment.generator.label }}
          </span>
        </div>
      </div>

      <div class="pipe-slot" aria-hidden="true">
        <span class="pipe" :class="{ active: equipment.pathToGrid }"></span>
      </div>

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
  </div>
</template>
