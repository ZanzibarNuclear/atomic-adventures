<script setup>
import { computed } from "vue";
import { characterWellbeingOverview } from "../../../lib/character/panel.js";

const props = defineProps({
  character: { type: Object, required: true },
});

const wellbeing = computed(() => characterWellbeingOverview(props.character));

function rangeMin(vital) {
  return Number.isFinite(Number(vital?.min)) ? Number(vital.min) : 0;
}

function rangeMax(vital) {
  return Math.max(rangeMin(vital), Number.isFinite(Number(vital?.max)) ? Number(vital.max) : 100);
}

function rangeValue(vital) {
  const min = rangeMin(vital);
  const max = rangeMax(vital);
  const value = Number.isFinite(Number(vital?.value)) ? Number(vital.value) : min;
  return Math.min(max, Math.max(min, value));
}

function rangePercentage(vital) {
  const span = rangeMax(vital) - rangeMin(vital);
  if (span <= 0) return 0;
  return ((rangeValue(vital) - rangeMin(vital)) / span) * 100;
}
</script>

<template>
  <section class="panel-card" aria-labelledby="character-health-heading">
    <h3 id="character-health-heading">Health</h3>
    <dl class="stat-list">
      <div v-for="vital in wellbeing.vitals" :key="vital.id">
        <dt>{{ vital.label }}</dt>
        <dd>
          <span class="measure-detail">
            <span
              class="vital-track"
              :class="vital.tone"
              role="progressbar"
              :aria-label="`${vital.label}: ${vital.state}`"
              :aria-valuemin="rangeMin(vital)"
              :aria-valuemax="rangeMax(vital)"
              :aria-valuenow="rangeValue(vital)"
              :aria-valuetext="vital.state">
              <span
                class="vital-fill"
                :style="{ width: `${rangePercentage(vital)}%` }"></span>
            </span>
            <span class="vital-state" :class="vital.tone">{{ vital.state }}</span>
          </span>
        </dd>
      </div>
    </dl>
    <h3 class="section-heading">Conditions</h3>
    <ul class="condition-list">
      <li
        v-for="condition in wellbeing.conditions"
        :key="condition.id"
        :class="{ active: condition.active }">
        <span>{{ condition.label }}</span>
        <span class="condition-state" :class="condition.tone">
          <strong>{{ condition.state }}</strong>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel-card {
  min-width: 0;
  padding: 1rem;
  border: 1px solid #394454;
  border-radius: 10px;
  background: rgba(24, 29, 37, 0.72);
}
h3 {
  margin: 0;
}
.section-heading {
  margin-top: 1.15rem;
}
.stat-list {
  display: grid;
  gap: 0.65rem;
  margin: 0.9rem 0 0;
}
.stat-list div,
.condition-list li {
  display: grid;
  /* Fixed label column keeps bars aligned; free space lives in the value column. */
  grid-template-columns: 4.75rem minmax(0, 1fr);
  align-items: center;
  gap: 0.4rem;
}
.stat-list dt,
.condition-list li > span:first-child,
.empty-state {
  color: #8f98a6;
  font-size: 0.88rem;
}
.stat-list dd {
  min-width: 0;
  margin: 0;
}
.measure-detail {
  display: grid;
  /* Bar fills remaining card width; status sits left-justified after it. */
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.vital-track {
  width: 100%;
  height: 0.7rem;
  overflow: hidden;
  border: 1px solid rgba(168, 240, 178, 0.26);
  border-radius: 999px;
  background: rgba(10, 16, 22, 0.7);
}
.vital-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4e9c5d, #a8f0b2);
  transition: width 0.2s ease;
}
.vital-track.warning {
  border-color: rgba(255, 188, 122, 0.35);
}
.vital-track.warning .vital-fill {
  background: linear-gradient(90deg, #a45f25, #ffbc7a);
}
.vital-track.error {
  border-color: rgba(255, 154, 154, 0.35);
}
.vital-track.error .vital-fill {
  background: linear-gradient(90deg, #9a3e3e, #ff9a9a);
}
.vital-state,
.condition-state strong {
  font-weight: 600;
  font-size: 0.88rem;
  text-align: left;
  justify-self: start;
}
.vital-state.positive,
.condition-state.positive strong {
  color: #9fdbad;
}
.vital-state.warning,
.condition-state.warning strong {
  color: #ffb38a;
}
.vital-state.error,
.condition-state.error strong {
  color: #ff8a8a;
}
.condition-list {
  display: grid;
  gap: 0.55rem;
  padding: 0;
  margin: 0.75rem 0 0;
  list-style: none;
}
.condition-state {
  justify-self: start;
  text-align: left;
}
</style>
