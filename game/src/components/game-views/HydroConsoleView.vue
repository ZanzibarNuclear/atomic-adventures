<script setup>
import { computed } from "vue";
import { useHydroConsoleMonitor } from "../../composables/useHydroConsoleMonitor.js";
import HydroDiagnosticsPanel from "./hydro-console/HydroDiagnosticsPanel.vue";
import HydroEventHistory from "./hydro-console/HydroEventHistory.vue";
import HydroGraphsPanel from "./hydro-console/HydroGraphsPanel.vue";
import HydroReadoutPanel from "./hydro-console/HydroReadoutPanel.vue";
import HydroReportPanel from "./hydro-console/HydroReportPanel.vue";
import HydroSchematicPanel from "./hydro-console/HydroSchematicPanel.vue";

const PANEL_ID = "hydro-control-room-panel";

const props = defineProps({
  gameState: { type: Object, required: true },
  payload: { type: Object, default: null },
});

defineEmits(["return-to-map"]);

const panelId = computed(() => props.payload?.panelId ?? PANEL_ID);
const validPanel = computed(() => panelId.value === PANEL_ID);

const {
  diagnostics,
  eventLog,
  eventMarkers,
  fieldChecks,
  flowHeadGraph,
  guidedActions,
  lastReport,
  latestSample,
  markerLines,
  powerGraph,
  pressureSpeedGraph,
  readouts,
  sampleTimeLabel,
  statusLabel,
  telemetry,
} = useHydroConsoleMonitor(props.gameState, validPanel);
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
        <HydroSchematicPanel
          :field-checks="fieldChecks"
          :status-label="statusLabel"
          :telemetry="telemetry" />

        <HydroReadoutPanel :readouts="readouts" />

        <HydroDiagnosticsPanel
          :diagnostics="diagnostics"
          :guided-actions="guidedActions"
          @return-to-map="$emit('return-to-map')" />

        <HydroGraphsPanel
          :event-markers="eventMarkers"
          :flow-head-graph="flowHeadGraph"
          :latest-sample="latestSample"
          :marker-lines="markerLines"
          :power-graph="powerGraph"
          :pressure-speed-graph="pressureSpeedGraph"
          :sample-time-label="sampleTimeLabel"
          :telemetry="telemetry" />

        <HydroReportPanel :report="lastReport" />

        <HydroEventHistory :events="eventLog" />
      </section>
    </template>
  </section>
</template>

<style>
.hydro-console-view {
  min-height: calc(100vh - 4rem);
  padding: 1.25rem clamp(1rem, 3vw, 2.25rem) 2rem;
  color: #eef7f1;
  background:
    linear-gradient(135deg, rgba(9, 24, 26, 0.96), rgba(21, 28, 34, 0.98) 52%, rgba(18, 20, 24, 0.98)),
    #121820;
}

.hydro-console-view .console-header,
.hydro-console-view .console-grid {
  max-width: 1120px;
  margin: 0 auto;
}

.hydro-console-view .console-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.hydro-console-view .console-header h1 {
  margin: 0.1rem 0 0;
  font-size: clamp(1.7rem, 4vw, 2.8rem);
  letter-spacing: 0;
}

.hydro-console-view .eyebrow {
  margin: 0;
  color: #8dd6cb;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.hydro-console-view button {
  border: 1px solid #79c7b8;
  border-radius: 7px;
  background: #dff9ef;
  color: #0b2523;
  padding: 0.6rem 0.8rem;
  font-weight: 700;
}

.hydro-console-view .exit-button {
  background: transparent;
  color: #d6f6ee;
}

.hydro-console-view .console-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
  gap: 0.85rem;
}

.hydro-console-view .schematic-panel,
.hydro-console-view .readout-panel,
.hydro-console-view .diagnostics-panel,
.hydro-console-view .graphs-panel,
.hydro-console-view .report-panel,
.hydro-console-view .history-panel,
.hydro-console-view .console-error {
  border: 1px solid rgba(141, 214, 203, 0.28);
  border-radius: 8px;
  background: rgba(8, 18, 20, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.hydro-console-view .schematic-panel,
.hydro-console-view .diagnostics-panel,
.hydro-console-view .graphs-panel,
.hydro-console-view .report-panel,
.hydro-console-view .history-panel,
.hydro-console-view .console-error {
  padding: 1rem;
}

.hydro-console-view .status-strip {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #abc7c0;
}

.hydro-console-view .status-strip strong {
  color: #ffe09a;
}

.hydro-console-view .plant-line {
  display: grid;
  grid-template-columns: max-content minmax(4rem, 1fr) max-content minmax(4rem, 1fr) max-content;
  align-items: center;
  gap: 0.5rem;
  min-height: 7rem;
}

.hydro-console-view .node {
  display: inline-grid;
  place-items: center;
  min-width: 5.25rem;
  min-height: 3.25rem;
  border: 1px solid rgba(223, 249, 239, 0.32);
  border-radius: 8px;
  background: #16292c;
  font-weight: 700;
}

.hydro-console-view .pipe {
  height: 0.45rem;
  border-radius: 999px;
  background: #344448;
}

.hydro-console-view .pipe.active {
  background: linear-gradient(90deg, #5fb7dd, #85d78a);
}

.hydro-console-view .field-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.hydro-console-view .check {
  border: 1px solid rgba(255, 190, 120, 0.38);
  border-radius: 999px;
  padding: 0.32rem 0.5rem;
  color: #ffd9aa;
  background: rgba(96, 52, 24, 0.35);
  font-size: 0.85rem;
}

.hydro-console-view .check.ok {
  border-color: rgba(133, 215, 138, 0.5);
  color: #c9f5c9;
  background: rgba(24, 78, 50, 0.35);
}

.hydro-console-view .readout-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
}

.hydro-console-view .readout {
  display: grid;
  gap: 0.35rem;
  min-height: 5.5rem;
  padding: 0.9rem;
  border-right: 1px solid rgba(141, 214, 203, 0.18);
  border-bottom: 1px solid rgba(141, 214, 203, 0.18);
}

.hydro-console-view .readout span,
.hydro-console-view .quiet,
.hydro-console-view li span {
  color: #abc7c0;
}

.hydro-console-view .readout strong {
  font-size: 1.35rem;
  color: #f4f7ef;
}

.hydro-console-view .diagnostics-panel h2,
.hydro-console-view .graphs-panel h2,
.hydro-console-view .report-panel h2,
.hydro-console-view .history-panel h2 {
  margin: 0 0 0.7rem;
  font-size: 1rem;
}

.hydro-console-view .guided-actions {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(141, 214, 203, 0.18);
}

.hydro-console-view .guided-actions h3 {
  margin: 0;
  color: #e7f4ee;
  font-size: 0.92rem;
}

.hydro-console-view .guided-action {
  display: grid;
  gap: 0.35rem;
}

.hydro-console-view .guided-action span {
  color: #abc7c0;
}

.hydro-console-view .guided-action button {
  justify-self: start;
  margin-top: 0.15rem;
  padding: 0.45rem 0.65rem;
}

.hydro-console-view .graphs-panel {
  grid-column: 1 / -1;
}

.hydro-console-view .graphs-header,
.hydro-console-view .graph-labels,
.hydro-console-view .legend {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.hydro-console-view .graphs-header span,
.hydro-console-view .graph-labels span,
.hydro-console-view .legend {
  color: #abc7c0;
}

.hydro-console-view .graph-stack {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.hydro-console-view .graph-card {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
  min-height: 10rem;
  padding: 0.8rem;
  border: 1px solid rgba(141, 214, 203, 0.18);
  border-radius: 8px;
  background: rgba(5, 12, 15, 0.5);
}

.hydro-console-view .graph-labels {
  min-height: 2.4rem;
}

.hydro-console-view .graph-labels strong,
.hydro-console-view .graph-labels span {
  overflow-wrap: anywhere;
}

.hydro-console-view .graph-card svg {
  width: 100%;
  height: 5.5rem;
  border: 1px solid rgba(141, 214, 203, 0.14);
  border-radius: 6px;
  background:
    linear-gradient(rgba(141, 214, 203, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(141, 214, 203, 0.08) 1px, transparent 1px),
    rgba(7, 16, 19, 0.82);
  background-size: 100% 33.333%, 25% 100%, 100% 100%;
}

.hydro-console-view .graph-card polyline {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.hydro-console-view .event-marker-line {
  stroke: rgba(255, 255, 255, 0.42);
  stroke-width: 1;
  stroke-dasharray: 2 2;
  vector-effect: non-scaling-stroke;
}

.hydro-console-view .event-markers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.8rem;
  color: #abc7c0;
}

.hydro-console-view .event-markers h3 {
  width: 100%;
  margin: 0 0 0.1rem;
  color: #e7f4ee;
  font-size: 0.92rem;
}

.hydro-console-view .event-markers span {
  border: 1px solid rgba(141, 214, 203, 0.22);
  border-radius: 999px;
  padding: 0.28rem 0.45rem;
  background: rgba(7, 16, 19, 0.52);
  font-size: 0.82rem;
}

.hydro-console-view .report-panel dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 0;
}

.hydro-console-view .report-panel div {
  display: grid;
  gap: 0.2rem;
}

.hydro-console-view .report-panel dt {
  color: #abc7c0;
  font-size: 0.82rem;
}

.hydro-console-view .report-panel dd {
  margin: 0;
  color: #f4f7ef;
  font-weight: 700;
}

.hydro-console-view .legend {
  justify-content: flex-start;
  flex-wrap: wrap;
  min-height: 1.2rem;
  font-size: 0.82rem;
}

.hydro-console-view .legend span {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.hydro-console-view .legend i {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
}

.hydro-console-view ul,
.hydro-console-view ol {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hydro-console-view li {
  display: grid;
  gap: 0.15rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(141, 214, 203, 0.14);
}

.hydro-console-view .console-error {
  max-width: 720px;
  margin: 0 auto;
}

@media (max-width: 760px) {
  .hydro-console-view .console-header,
  .hydro-console-view .console-grid,
  .hydro-console-view .plant-line {
    display: grid;
  }

  .hydro-console-view .console-grid,
  .hydro-console-view .readout-panel,
  .hydro-console-view .graph-stack {
    grid-template-columns: 1fr;
  }
}
</style>
