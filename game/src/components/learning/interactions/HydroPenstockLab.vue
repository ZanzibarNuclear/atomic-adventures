<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  defaultPenstockLabKnobs,
  evaluatePenstockLab,
  summarizePenstockResult,
} from "../../../lib/learning/penstockLabModel.js";

const props = defineProps({
  /** clearwater | ideal */
  preset: { type: String, default: "clearwater" },
  caption: { type: String, default: "" },
});

const emit = defineEmits(["experimented"]);

const knobs = ref(defaultPenstockLabKnobs(props.preset));
const summary = ref(summarizePenstockResult(null));
const engineReady = ref(false);
const engineError = ref("");
const experimented = ref(false);

/** @type {null | ((plantJson: string, operatorJson?: string) => object)} */
let evaluateHydroFn = null;
let disposed = false;

const notes = computed(() => summary.value.warnings ?? []);

onMounted(() => {
  void loadEngineAndEvaluate();
});

onBeforeUnmount(() => {
  disposed = true;
  evaluateHydroFn = null;
});

watch(
  () => props.preset,
  (preset) => {
    knobs.value = defaultPenstockLabKnobs(preset);
    runEval();
  },
);

watch(knobs, () => {
  markExperimented();
  runEval();
}, { deep: true });

function markExperimented() {
  if (experimented.value) return;
  experimented.value = true;
  emit("experimented");
}

function resetDefaults() {
  knobs.value = defaultPenstockLabKnobs(props.preset);
  runEval();
}

async function loadEngineAndEvaluate() {
  try {
    const mod = await import("../../../lib/simulations/energySim/pkg/energy_sim_wasm.js");
    if (typeof mod.default === "function") {
      await mod.default();
    }
    if (disposed) return;
    if (typeof mod.evaluateHydro !== "function") {
      throw new Error("evaluateHydro missing from energy-sim-wasm");
    }
    evaluateHydroFn = mod.evaluateHydro;
    engineReady.value = true;
    engineError.value = "";
  } catch (err) {
    if (disposed) return;
    engineReady.value = false;
    engineError.value = err?.message ?? String(err);
  }
  runEval();
}

function runEval() {
  const report = evaluatePenstockLab(knobs.value, evaluateHydroFn);
  if (!report.ok) {
    if (report.reason !== "no-engine") {
      engineError.value = report.reason;
    }
    summary.value = summarizePenstockResult(null);
    return;
  }
  summary.value = summarizePenstockResult(report.result);
}
</script>

<template>
  <div class="penstock-lab" data-testid="hydro-penstock-lab">
    <header class="lab-header">
      <div>
        <p class="eyebrow">Interactive lab</p>
        <h3>Penstock configuration</h3>
        <p class="lede">
          Adjust a diversion plant like Clearwater Station. This sandbox does not change the live generator.
        </p>
      </div>
      <button type="button" class="ghost" @click="resetDefaults">Reset defaults</button>
    </header>

    <p v-if="caption" class="caption">{{ caption }}</p>
    <p v-if="engineError && !engineReady" class="lab-error">
      Simulator unavailable ({{ engineError }}). Open this lesson in the game browser to run the lab.
    </p>
    <p v-else-if="!engineReady" class="lab-status">Loading energy model…</p>

    <div class="lab-grid">
      <section class="knobs" aria-label="Plant knobs">
        <label>
          <span>Gross head (m)</span>
          <input v-model.number="knobs.grossHeadM" type="range" min="5" max="50" step="0.5">
          <strong>{{ knobs.grossHeadM.toFixed(1) }} m</strong>
        </label>
        <label>
          <span>Stream available flow (m³/s)</span>
          <input v-model.number="knobs.availableFlowM3s" type="range" min="0.01" max="0.08" step="0.005">
          <strong>{{ knobs.availableFlowM3s.toFixed(3) }} m³/s</strong>
        </label>
        <label>
          <span>Penstock diameter (m)</span>
          <input v-model.number="knobs.diameterM" type="range" min="0.1" max="0.5" step="0.01">
          <strong>{{ knobs.diameterM.toFixed(2) }} m</strong>
        </label>
        <label>
          <span>Penstock length (m)</span>
          <input v-model.number="knobs.lengthM" type="range" min="40" max="400" step="5">
          <strong>{{ knobs.lengthM.toFixed(0) }} m</strong>
        </label>
        <label>
          <span>Gate opening</span>
          <input v-model.number="knobs.gateOpening" type="range" min="0" max="1" step="0.05">
          <strong>{{ Math.round(knobs.gateOpening * 100) }}%</strong>
        </label>
        <label>
          <span>Debris / screen clog</span>
          <input v-model.number="knobs.debrisClogFraction" type="range" min="0" max="0.9" step="0.05">
          <strong>{{ Math.round(knobs.debrisClogFraction * 100) }}%</strong>
        </label>
        <label>
          <span>Leakage</span>
          <input v-model.number="knobs.leakageFraction" type="range" min="0" max="0.5" step="0.05">
          <strong>{{ Math.round(knobs.leakageFraction * 100) }}%</strong>
        </label>
      </section>

      <section class="readouts" aria-label="Lab results" aria-live="polite">
        <div class="metric">
          <span>Net head</span>
          <strong>{{ summary.netHeadM.toFixed(2) }} m</strong>
          <small>loss {{ summary.headLossM.toFixed(2) }} m</small>
        </div>
        <div class="metric">
          <span>Turbine flow</span>
          <strong>{{ summary.flowM3s.toFixed(4) }} m³/s</strong>
        </div>
        <div class="metric highlight">
          <span>Electrical power</span>
          <strong>{{ summary.electricalPowerKw.toFixed(3) }} kW</strong>
          <small>hydraulic {{ summary.hydraulicPowerKw.toFixed(3) }} kW</small>
        </div>
        <div class="metric">
          <span>Turbine speed</span>
          <strong>{{ Math.round(summary.turbineSpeedRpm) }} rpm</strong>
        </div>
        <ul v-if="notes.length" class="notes">
          <li v-for="note in notes" :key="note"><span class="note-tag">Note</span> {{ note }}</li>
        </ul>
        <p v-else class="quiet">No notes — operating near a clean design point.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.penstock-lab {
  margin-top: 0.35rem;
  padding: 0.9rem;
  border: 1px solid var(--color-brand-border);
  border-radius: 10px;
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--color-cherenkov) 12%, #123034) 0%, rgba(8, 16, 22, 0.92) 100%);
}

.lab-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.lab-header h3 {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
}

.eyebrow {
  margin: 0;
  color: var(--color-cherenkov);
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

.lede,
.caption,
.quiet,
.lab-status {
  color: #a9c7c3;
  margin: 0.35rem 0 0;
}

.lab-error {
  color: #ffb4a8;
  margin: 0.5rem 0 0;
}

.ghost {
  border: 1px solid var(--color-brand-border);
  border-radius: 7px;
  background: transparent;
  color: #d8f6f1;
  padding: 0.45rem 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.lab-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
  gap: 0.9rem;
  margin-top: 0.9rem;
}

.knobs {
  display: grid;
  gap: 0.65rem;
}

.knobs label {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.75rem;
  align-items: center;
}

.knobs label span {
  grid-column: 1 / -1;
  color: #b7d8d3;
  font-size: 0.88rem;
}

.knobs input[type="range"] {
  width: 100%;
}

.knobs strong {
  font-variant-numeric: tabular-nums;
  color: #eef7f1;
  min-width: 5.5rem;
  text-align: right;
}

.readouts {
  display: grid;
  gap: 0.55rem;
  align-content: start;
}

.metric {
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(139, 216, 210, 0.22);
  border-radius: 8px;
  background: rgba(5, 12, 16, 0.55);
}

.metric.highlight {
  border-color: rgba(143, 240, 164, 0.45);
}

.metric span {
  display: block;
  color: #9fc4bf;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metric strong {
  display: block;
  margin-top: 0.15rem;
  font-size: 1.25rem;
  color: #f2fbf8;
}

.metric small {
  color: #8eaea9;
}

.notes {
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
}

.notes li {
  color: #c9e0db;
  font-size: 0.88rem;
}

.note-tag {
  display: inline-block;
  margin-right: 0.35rem;
  color: var(--color-cherenkov);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

@media (max-width: 720px) {
  .lab-grid {
    grid-template-columns: 1fr;
  }
}
</style>
