<script setup>
import { computed } from "vue";
import { generateHydroTelemetry } from "../../lib/simulations/hydro/index.js";
import { ensureHydroFacilityState } from "../../composables/useHydroFacility.js";

const PANEL_ID = "hydro-control-room-panel";

const props = defineProps({
  gameState: { type: Object, required: true },
  payload: { type: Object, default: null },
});

defineEmits(["return-to-map"]);

const panelId = computed(() => props.payload?.panelId ?? PANEL_ID);
const validPanel = computed(() => panelId.value === PANEL_ID);
const hydroState = computed(() => ensureHydroFacilityState(props.gameState));
const telemetry = computed(() => generateHydroTelemetry(hydroState.value));
const eventLog = computed(() => hydroState.value.eventLog.slice(-6).reverse());
const statusLabel = computed(() => statusLabels[telemetry.value.status] ?? telemetry.value.status);
const diagnostics = computed(() => [
  ...telemetry.value.faults.map((id) => diagnosticLine(id, "Fault")),
  ...telemetry.value.warnings.map((id) => diagnosticLine(id, "Warning")),
]);

const readouts = computed(() => [
  { id: "output", label: "Output", value: `${telemetry.value.generatorOutputKw.toFixed(3)} kW` },
  { id: "pressure", label: "Pressure", value: `${telemetry.value.penstockPressureKpa.toFixed(1)} kPa` },
  { id: "speed", label: "Turbine", value: `${telemetry.value.turbineSpeedRpm} rpm` },
  { id: "flow", label: "Flow", value: `${telemetry.value.flowM3s.toFixed(3)} m3/s` },
  { id: "head", label: "Net head", value: `${telemetry.value.netHeadM.toFixed(2)} m` },
]);

const fieldChecks = computed(() => [
  { id: "intake-clear", label: "Intake clear", ok: hydroState.value.intakeClear },
  { id: "intake-open", label: "Intake open", ok: hydroState.value.intakeOpen },
  { id: "upstream-valve", label: "Upstream valve", ok: hydroState.value.manualValves.upstreamOpen },
  { id: "powerhouse-valve", label: "Powerhouse valve", ok: hydroState.value.manualValves.powerhouseOpen },
  { id: "startup", label: "Startup complete", ok: hydroState.value.startupComplete },
  { id: "online", label: "Station power", ok: hydroState.value.online },
]);

const statusLabels = {
  "configuration-missing": "Configuration missing",
  "faulted": "Faulted",
  "insufficient-flow": "Insufficient flow",
  "insufficient-pressure": "Insufficient pressure",
  "offline": "Offline",
  "online": "Online",
  "ready": "Ready",
  "spinning-up": "Spinning up",
  "startup-blocked": "Startup blocked",
};

const diagnosticLabels = {
  "configuration-missing": "The selected hydro configuration was not found.",
  "intake-blocked": "The intake is blocked.",
  "intake-closed": "The intake gate is closed.",
  "intake-debris-reducing-flow": "Debris is reducing captured flow.",
  "intake-needs-clearing": "The intake still needs field clearing.",
  "low-pressure": "Penstock pressure is below the startup target.",
  "low-stream-flow": "Mill Brook flow is below the useful range.",
  "low-turbine-speed": "The turbine is below the target speed.",
  "major-penstock-leak": "A major penstock leak is preventing stable operation.",
  "manual-valves-not-open": "Manual valves are not fully open.",
  "penstock-leakage": "Penstock leakage is reducing output.",
  "startup-incomplete": "The generator startup sequence is incomplete.",
};

function diagnosticLine(id, kind) {
  return {
    id,
    kind,
    label: diagnosticLabels[id] ?? id,
  };
}
</script>

<template>
  <section class="hydro-console-view">
    <header class="console-header">
      <div>
        <p class="eyebrow">Hydro control room</p>
        <h1>Generator console</h1>
      </div>
      <button class="exit-button" type="button" @click="$emit('return-to-map')">Return to map</button>
    </header>

    <section v-if="!validPanel" class="console-error">
      <h2>Console unavailable</h2>
      <p>Unknown panel ID: {{ panelId }}</p>
    </section>

    <template v-else>
      <section class="console-grid">
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

        <div class="readout-panel">
          <div v-for="item in readouts" :key="item.id" class="readout">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="diagnostics-panel">
          <h2>Diagnostics</h2>
          <p v-if="!diagnostics.length" class="quiet">No warnings or faults.</p>
          <ul v-else>
            <li v-for="item in diagnostics" :key="`${item.kind}:${item.id}`">
              <strong>{{ item.kind }}</strong>
              <span>{{ item.label }}</span>
            </li>
          </ul>
        </div>

        <div class="history-panel">
          <h2>Recent events</h2>
          <p v-if="!eventLog.length" class="quiet">No hydro events recorded.</p>
          <ol v-else>
            <li v-for="event in eventLog" :key="event.eventId">
              <span>{{ Math.round(event.elapsedMinutes) }} min</span>
              <strong>{{ event.label || event.type }}</strong>
            </li>
          </ol>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.hydro-console-view {
  min-height: calc(100vh - 4rem);
  padding: 1.25rem clamp(1rem, 3vw, 2.25rem) 2rem;
  color: #eef7f1;
  background:
    linear-gradient(135deg, rgba(9, 24, 26, 0.96), rgba(21, 28, 34, 0.98) 52%, rgba(18, 20, 24, 0.98)),
    #121820;
}

.console-header,
.console-grid {
  max-width: 1120px;
  margin: 0 auto;
}

.console-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.console-header h1 {
  margin: 0.1rem 0 0;
  font-size: clamp(1.7rem, 4vw, 2.8rem);
  letter-spacing: 0;
}

.eyebrow {
  margin: 0;
  color: #8dd6cb;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

button {
  border: 1px solid #79c7b8;
  border-radius: 7px;
  background: #dff9ef;
  color: #0b2523;
  padding: 0.6rem 0.8rem;
  font-weight: 700;
}

.exit-button {
  background: transparent;
  color: #d6f6ee;
}

.console-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
  gap: 0.85rem;
}

.schematic-panel,
.readout-panel,
.diagnostics-panel,
.history-panel,
.console-error {
  border: 1px solid rgba(141, 214, 203, 0.28);
  border-radius: 8px;
  background: rgba(8, 18, 20, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.schematic-panel,
.diagnostics-panel,
.history-panel,
.console-error {
  padding: 1rem;
}

.status-strip {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #abc7c0;
}

.status-strip strong {
  color: #ffe09a;
}

.plant-line {
  display: grid;
  grid-template-columns: max-content minmax(4rem, 1fr) max-content minmax(4rem, 1fr) max-content;
  align-items: center;
  gap: 0.5rem;
  min-height: 7rem;
}

.node {
  display: inline-grid;
  place-items: center;
  min-width: 5.25rem;
  min-height: 3.25rem;
  border: 1px solid rgba(223, 249, 239, 0.32);
  border-radius: 8px;
  background: #16292c;
  font-weight: 700;
}

.pipe {
  height: 0.45rem;
  border-radius: 999px;
  background: #344448;
}

.pipe.active {
  background: linear-gradient(90deg, #5fb7dd, #85d78a);
}

.field-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.check {
  border: 1px solid rgba(255, 190, 120, 0.38);
  border-radius: 999px;
  padding: 0.32rem 0.5rem;
  color: #ffd9aa;
  background: rgba(96, 52, 24, 0.35);
  font-size: 0.85rem;
}

.check.ok {
  border-color: rgba(133, 215, 138, 0.5);
  color: #c9f5c9;
  background: rgba(24, 78, 50, 0.35);
}

.readout-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
}

.readout {
  display: grid;
  gap: 0.35rem;
  min-height: 5.5rem;
  padding: 0.9rem;
  border-right: 1px solid rgba(141, 214, 203, 0.18);
  border-bottom: 1px solid rgba(141, 214, 203, 0.18);
}

.readout span,
.quiet,
li span {
  color: #abc7c0;
}

.readout strong {
  font-size: 1.35rem;
  color: #f4f7ef;
}

.diagnostics-panel h2,
.history-panel h2 {
  margin: 0 0 0.7rem;
  font-size: 1rem;
}

ul,
ol {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  gap: 0.15rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(141, 214, 203, 0.14);
}

.console-error {
  max-width: 720px;
  margin: 0 auto;
}

@media (max-width: 760px) {
  .console-header,
  .console-grid,
  .plant-line {
    display: grid;
  }

  .console-grid,
  .readout-panel {
    grid-template-columns: 1fr;
  }
}
</style>
