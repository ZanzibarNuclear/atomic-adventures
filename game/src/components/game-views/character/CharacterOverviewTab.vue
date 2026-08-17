<script setup>
import { computed, ref, watch } from "vue";
import { characterWellbeingOverview } from "../../../lib/character/panel.js";
import { listWellbeingActions } from "../../../lib/character/wellbeingActions.js";
import { isQuickConsumeReady } from "../../../lib/character/quickConsume.js";

const props = defineProps({
  character: { type: Object, required: true },
  /** Game flags (or Set) used to gate Eat/Drink until supplies are known. */
  flags: { type: [Object, null], default: null },
  /** When false, actions render disabled (e.g. content-builder preview). */
  actionsEnabled: { type: Boolean, default: true },
  actionFeedback: { type: String, default: "" },
});

const emit = defineEmits(["wellbeing-action"]);

const wellbeing = computed(() => characterWellbeingOverview(props.character));
const wellbeingActions = computed(() => listWellbeingActions(props.character));
const consumeActions = computed(() => {
  const gameState = { character: props.character, flags: props.flags };
  return [
    {
      id: "eat",
      label: "Eat",
      hint: "Eat the first food in reach",
      ready: isQuickConsumeReady(gameState, "eat"),
      blockedHint: "Learn to eat Tastee Tack with water first.",
    },
    {
      id: "drink",
      label: "Drink",
      hint: "Drink the first beverage in reach",
      ready: isQuickConsumeReady(gameState, "drink"),
      blockedHint: "Learn to purify tap water first.",
    },
  ].filter((action) => action.ready);
});
const energyActions = computed(() =>
  wellbeingActions.value.filter((action) => ["rest", "nap", "sleep"].includes(action.id)),
);
const meditateAction = computed(() =>
  wellbeingActions.value.find((action) => action.id === "meditate") ?? null,
);
const activeConditions = computed(() =>
  (wellbeing.value.conditions ?? []).filter((condition) => condition.active),
);
const conditionsSummary = computed(() => {
  if (!activeConditions.value.length) return "None";
  return activeConditions.value.map((condition) => condition.state).join(", ");
});

const meditateMinutes = ref(10);

watch(
  wellbeingActions,
  (actions) => {
    const meditate = actions.find((entry) => entry.id === "meditate");
    if (meditate?.durationOptions?.length && !meditate.durationOptions.includes(meditateMinutes.value)) {
      meditateMinutes.value = meditate.defaultMinutes ?? meditate.durationOptions[0];
    }
  },
  { immediate: true },
);

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

function minutesFor(action) {
  if (action.id === "meditate") return Number(meditateMinutes.value);
  return undefined;
}

function actionTitle(action) {
  if (!props.actionsEnabled) return "Health actions are unavailable in this preview.";
  if (action.available === false) return action.reason || action.hint;
  if (action.fixedMinutes) return `${action.hint}`;
  if (action.wakeAtRatio != null) return action.hint;
  const minutes = minutesFor(action);
  if (minutes) return `${action.hint} (${minutes} min)`;
  return action.hint;
}

function runAction(action) {
  emit("wellbeing-action", {
    actionId: action.id,
    minutes: minutesFor(action),
  });
}

function runConsume(kind) {
  emit("wellbeing-action", { actionId: kind });
}

function consumeTitle(action) {
  if (!props.actionsEnabled) return "Health actions are unavailable in this preview.";
  if (!action.ready) return action.blockedHint || action.hint;
  return action.hint;
}

function formatDurationOption(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
</script>

<template>
  <div class="health-column">
    <section class="panel-card" aria-labelledby="character-health-heading">
      <h3 id="character-health-heading">Health</h3>
      <dl class="stat-list">
        <div v-for="vital in wellbeing.vitals" :key="vital.id" class="stat-row">
          <dt>{{ vital.label }}</dt>
          <dd class="stat-bar-cell">
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
          </dd>
          <dd class="stat-state-cell">
            <span class="vital-state" :class="vital.tone">{{ vital.state }}</span>
          </dd>
        </div>
      </dl>

      <h4 class="conditions-heading">Conditions</h4>
      <p class="conditions-summary" :class="{ empty: !activeConditions.length }">
        {{ conditionsSummary }}
      </p>
    </section>

    <section class="panel-card actions-card" aria-labelledby="character-health-actions-heading">
      <h3 id="character-health-actions-heading">Health actions</h3>
      <div class="action-rows">
        <div v-if="consumeActions.length" class="action-row consume-row">
          <button
            v-for="action in consumeActions"
            :key="action.id"
            type="button"
            class="sm brand wellbeing-action"
            :disabled="!actionsEnabled"
            :title="consumeTitle(action)"
            @click="runConsume(action.id)">
            {{ action.label }}
          </button>
        </div>
        <div class="action-row energy-row">
          <button
            v-for="action in energyActions"
            :key="action.id"
            type="button"
            class="sm brand wellbeing-action"
            :disabled="!actionsEnabled || !action.available"
            :title="actionTitle(action)"
            @click="runAction(action)">
            {{ action.label }}
          </button>
        </div>
        <div v-if="meditateAction" class="action-row meditate-row">
          <button
            type="button"
            class="sm brand wellbeing-action"
            :disabled="!actionsEnabled || !meditateAction.available"
            :title="actionTitle(meditateAction)"
            @click="runAction(meditateAction)">
            {{ meditateAction.label }}
          </button>
          <label class="duration-picker">
            <span class="sr-only">Meditate duration</span>
            <select
              v-model.number="meditateMinutes"
              :disabled="!actionsEnabled || !meditateAction.available"
              aria-label="Meditate duration">
              <option
                v-for="option in meditateAction.durationOptions"
                :key="option"
                :value="option">
                {{ formatDurationOption(option) }}
              </option>
            </select>
          </label>
        </div>
      </div>
      <p v-if="actionFeedback" class="action-feedback" role="status">{{ actionFeedback }}</p>
    </section>
  </div>
</template>

<style scoped>
.health-column {
  display: grid;
  gap: 1rem;
  min-width: 0;
  align-content: start;
}
.panel-card {
  min-width: 0;
  padding: 1rem;
  border: 1px solid #394454;
  border-radius: 10px;
  background: rgba(24, 29, 37, 0.72);
}
h3 {
  margin: 0;
  color: var(--color-cherenkov, #20c8fb);
}
.stat-list {
  display: grid;
  gap: 0.65rem;
  margin: 0.9rem 0 0;
}
/* label | expanding bar | left-justified state — bars share one column so max width aligns */
.stat-row {
  display: grid;
  grid-template-columns: 5.25rem minmax(0, 1fr) 6.5rem;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}
.stat-list dt {
  color: #8f98a6;
  font-size: 0.88rem;
}
.stat-bar-cell,
.stat-state-cell {
  min-width: 0;
  margin: 0;
}
.stat-state-cell {
  text-align: left;
  justify-self: stretch;
}
.vital-track {
  display: block;
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
.vital-state {
  font-weight: 600;
  font-size: 0.88rem;
  text-align: left;
}
.vital-state.positive {
  color: #9fdbad;
}
.vital-state.warning {
  color: #ffb38a;
}
.vital-state.error {
  color: #ff8a8a;
}
.conditions-heading {
  margin: 1rem 0 0.35rem;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.conditions-summary {
  margin: 0;
  color: #d5dce6;
  font-size: 0.88rem;
  line-height: 1.4;
}
.conditions-summary.empty {
  color: #8f98a6;
}
.action-rows {
  display: grid;
  gap: 0.65rem;
  justify-items: center;
  margin-top: 0.75rem;
}
.action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.wellbeing-action {
  min-width: 5.5rem;
}
.duration-picker select {
  min-width: 5.5rem;
  border: 1px solid #485267;
  border-radius: 6px;
  background: #171b22;
  color: #dbe2ea;
  padding: 0.35rem 0.5rem;
  font: inherit;
  font-size: 0.82rem;
}
.duration-picker select:disabled {
  opacity: 0.45;
}
.action-feedback {
  margin: 0.75rem 0 0;
  color: #c5d4e4;
  font-size: 0.86rem;
  line-height: 1.4;
  text-align: center;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
