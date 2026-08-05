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

function formatWatts(ratingW) {
  const w = Number(ratingW);
  if (!Number.isFinite(w)) return "—";
  if (w >= 1000) return `${(w / 1000).toFixed(1)} kW`;
  return `${Math.round(w)} W`;
}
</script>

<template>
  <div class="grid-panel" :class="{ dimmed: lightLevel > 0 && lightLevel < 1, offline: !busEnergized }">
    <div class="status-strip">
      <span>Station bus</span>
      <strong>{{ busEnergized ? "Energized" : "Offline" }}</strong>
    </div>

    <div class="grid-readouts">
      <div class="readout">
        <span>Generation</span>
        <strong>{{ availableKw.toFixed(2) }} kW</strong>
      </div>
      <div class="readout">
        <span>Station load</span>
        <strong>{{ loadKw.toFixed(2) }} kW</strong>
      </div>
      <div class="readout">
        <span>Margin</span>
        <strong :class="{ tight: marginKw < 0.5 && busEnergized, deficit: marginKw < 0 }">
          {{ marginKw >= 0 ? "+" : "" }}{{ marginKw.toFixed(2) }} kW
        </strong>
      </div>
    </div>

    <section class="utilization" aria-label="Grid utilization">
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
      <p class="quiet grid-status">
        Grid status: <strong>{{ gridStatus }}</strong>
        <template v-if="lightLevel > 0 && lightLevel < 1"> · service dimmed ({{ Math.round(lightLevel * 100) }}%)</template>
      </p>
    </section>

    <section class="load-table" aria-label="Station loads">
      <h2>Loads</h2>
      <p v-if="!loads.length" class="quiet">No load registry in this snapshot.</p>
      <table v-else>
        <thead>
          <tr>
            <th scope="col">Circuit</th>
            <th scope="col">Rating</th>
            <th scope="col">State</th>
            <th scope="col">Priority</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in loads" :key="row.id" :class="{ drawing: row.drawing }">
            <td>{{ row.label || row.id }}</td>
            <td>{{ formatWatts(row.ratingW) }}</td>
            <td>{{ row.drawing ? "Drawing" : "Idle" }}</td>
            <td>{{ row.priority || "—" }}</td>
          </tr>
        </tbody>
      </table>
      <p class="quiet load-hint">
        Utilization compares live generation to drawing loads. Heavy circuits (EV charge)
        and low stream days are where conservation matters.
      </p>
    </section>
  </div>
</template>
