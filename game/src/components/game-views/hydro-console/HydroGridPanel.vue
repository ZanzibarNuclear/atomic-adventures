<script setup>
import { computed } from "vue";

const props = defineProps({
  telemetry: { type: Object, required: true },
});

const availableKw = computed(() => Number(props.telemetry.availableGenerationKw ?? props.telemetry.generatorOutputKw ?? 0));
const loadKw = computed(() => Number(props.telemetry.totalLoadKw ?? 0));
const marginKw = computed(() => Number(
  props.telemetry.marginKw
    ?? (availableKw.value - loadKw.value),
));
const utilization = computed(() => {
  if (availableKw.value <= 0.001) return loadKw.value > 0 ? 1 : 0;
  return Math.min(1.5, loadKw.value / availableKw.value);
});
const utilizationPct = computed(() => Math.round(utilization.value * 100));
const busEnergized = computed(() => Boolean(props.telemetry.busEnergized ?? props.telemetry.status === "online"));
const gridStatus = computed(() => props.telemetry.gridStatus ?? "ok");
const lightLevel = computed(() => Number(props.telemetry.lightLevel ?? (busEnergized.value ? 1 : 0)));
const loads = computed(() => Array.isArray(props.telemetry.loads) ? props.telemetry.loads : []);
const barWidth = computed(() => `${Math.min(100, utilizationPct.value)}%`);
const overCapacity = computed(() => utilization.value > 1 || gridStatus.value === "brownout" || gridStatus.value === "shortage");
const marginTight = computed(() => Math.abs(marginKw.value) < 0.5 && busEnergized.value);
const marginDeficit = computed(() => marginKw.value < 0);

/**
 * Display power: watts under 1 kW, otherwise kW with one decimal.
 * @param {number} watts
 * @param {{ zero?: string, signed?: boolean }} [options]
 */
function formatPower(watts, { zero = "0 W", signed = false } = {}) {
  const raw = Number(watts);
  if (!Number.isFinite(raw)) return zero === "0 W" ? "—" : zero;
  const sign = signed ? (raw > 0 ? "+" : raw < 0 ? "-" : "") : "";
  const mag = Math.abs(raw);
  if (mag === 0) return signed && zero === "0 W" ? "0 W" : zero;
  if (mag >= 1000) {
    const kw = mag / 1000;
    const body = kw >= 10 ? `${Math.round(kw)} kW` : `${kw.toFixed(1)} kW`;
    return `${sign}${body}`;
  }
  return `${sign}${Math.round(mag)} W`;
}

function formatKwAsPower(kw, options) {
  const n = Number(kw);
  if (!Number.isFinite(n)) return formatPower(NaN, options);
  return formatPower(n * 1000, options);
}

/** Drawn demand for a circuit: full rating when drawing, else 0. */
function drawingWatts(row) {
  if (!row?.drawing) return 0;
  const w = Number(row.ratingW);
  return Number.isFinite(w) && w > 0 ? w : 0;
}
</script>

<template>
  <!-- Fragment: stats strip (no panel card) + utilization card + loads card -->
  <div
    class="grid-readouts"
    :class="{ dimmed: lightLevel > 0 && lightLevel < 1, offline: !busEnergized }">
    <div class="readout">
      <span>Generation</span>
      <strong>{{ formatKwAsPower(availableKw) }}</strong>
    </div>
    <div class="readout">
      <span>Station load</span>
      <strong>{{ formatKwAsPower(loadKw) }}</strong>
    </div>
    <div class="readout">
      <span>Margin</span>
      <strong :class="{ tight: marginTight, deficit: marginDeficit }">
        {{ formatKwAsPower(marginKw, { signed: true }) }}
      </strong>
    </div>
  </div>

  <section
    class="grid-panel utilization"
    :class="{ dimmed: lightLevel > 0 && lightLevel < 1, offline: !busEnergized }"
    aria-label="Grid utilization">
    <div class="util-header">
      <h2>Utilization</h2>
      <span :class="{ over: overCapacity }">{{ utilizationPct }}% of available</span>
    </div>
    <div class="util-track" role="meter" :aria-valuenow="utilizationPct" aria-valuemin="0" aria-valuemax="100">
      <div
        class="util-fill"
        :class="{ over: overCapacity, idle: loadKw <= 0 }"
        :style="{ width: barWidth }" />
    </div>
  </section>

  <section
    class="grid-panel load-table"
    :class="{ dimmed: lightLevel > 0 && lightLevel < 1, offline: !busEnergized }"
    aria-label="Station loads">
    <h2>Loads</h2>
    <p v-if="!loads.length" class="quiet">No load registry in this snapshot.</p>
    <table v-else>
      <thead>
        <tr>
          <th scope="col">Circuit</th>
          <th scope="col">Rating</th>
          <th scope="col">Drawing</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in loads" :key="row.id" :class="{ drawing: row.drawing }">
          <td>{{ row.label || row.id }}</td>
          <td>{{ formatPower(row.ratingW, { zero: "—" }) }}</td>
          <td>{{ formatPower(drawingWatts(row), { zero: "0 W" }) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
