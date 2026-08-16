<script setup>
import { watch } from "vue";
import BuilderBtnIcon from "../builder/BuilderBtnIcon.vue";

const ACTIVITIES = [
  { id: "resting", label: "Resting" },
  { id: "light", label: "Light" },
  { id: "moderate", label: "Moderate" },
  { id: "strenuous", label: "Strenuous" },
];
const TONES = ["positive", "warning", "error"];

const props = defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
  setOptionalNumber: { type: Function, required: true },
});

watch(
  () => props.entry,
  (entry) => {
    entry.displayStates ??= [];
    entry.thresholds ??= [];
  },
  { immediate: true },
);

function driftRate(activity) {
  const value = props.entry.drift?.perGameHour?.[activity];
  return value == null || value === "" ? "" : value;
}

function setDriftRate(activity, raw) {
  const entry = props.entry;
  if (raw === "" || raw == null) {
    if (!entry.drift?.perGameHour) return;
    delete entry.drift.perGameHour[activity];
    if (!Object.keys(entry.drift.perGameHour).length) {
      delete entry.drift.perGameHour;
      delete entry.drift;
    }
    return;
  }
  entry.drift ??= {};
  entry.drift.perGameHour ??= {};
  entry.drift.perGameHour[activity] = Number(raw);
}

function addDisplayState() {
  props.entry.displayStates.push({ at: 0, state: "", tone: "positive" });
}

function addThreshold() {
  props.entry.thresholds.push({ at: 0, state: "", effectsPerGameHour: [] });
}

function addThresholdEffect(threshold) {
  threshold.effectsPerGameHour ??= [];
  threshold.effectsPerGameHour.push({
    op: "stat.add",
    id: props.draft.stats[0]?.id ?? "health",
    value: 0,
  });
}

function isMeter() {
  return props.entry.type === "meter";
}
</script>

<template>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Stat behavior</h4>
      <code>{{ entry.type }}</code>
    </div>
    <div class="field-grid">
      <label>Type
        <select v-model="entry.type">
          <option value="integer">integer</option>
          <option value="decimal">decimal</option>
          <option value="meter">meter</option>
          <option value="boolean">boolean</option>
          <option value="enum">enum</option>
        </select>
      </label>
      <label>Group
        <select v-model="entry.group">
          <option :value="null">No group</option>
          <option v-for="group in draft.panel.statGroups" :key="group.id" :value="group.id">
            {{ group.label }}
          </option>
        </select>
      </label>
      <label>Direction
        <select v-model="entry.direction">
          <option value="higher-is-better">Higher is better</option>
        </select>
      </label>
      <label>Default<input v-model.number="entry.default" type="number"></label>
      <label>Minimum
        <input :value="entry.min" type="number" @input="setOptionalNumber(entry, 'min', $event)">
      </label>
      <label>Maximum
        <input :value="entry.max" type="number" @input="setOptionalNumber(entry, 'max', $event)">
      </label>
    </div>
  </section>

  <section v-if="isMeter()" class="field-panel">
    <div class="section-heading">
      <h4>Hourly drift</h4>
      <code>{{ entry.drift?.perGameHour ? "active" : "none" }}</code>
    </div>
    <p class="hint">
      Points added or removed each game hour. Leave a field blank for no drift
      at that activity.
    </p>
    <div class="field-grid">
      <label v-for="activity in ACTIVITIES" :key="activity.id">
        {{ activity.label }}
        <input
          :value="driftRate(activity.id)"
          type="number"
          step="0.001"
          placeholder="none"
          @input="setDriftRate(activity.id, $event.target.value)">
      </label>
    </div>
  </section>

  <section v-if="isMeter()" class="field-panel">
    <div class="section-heading">
      <h4>Display states</h4>
      <button type="button" class="sm add-btn" @click="addDisplayState">
        <BuilderBtnIcon name="add" />
        Add state
      </button>
    </div>
    <p class="hint">
      Player-facing band labels. The highest “at” that the current value still
      meets is the one shown.
    </p>
    <article
      v-for="(state, index) in (entry.displayStates ?? [])"
      :key="index"
      class="editor-card">
      <div class="field-grid">
        <label>At or above<input v-model.number="state.at" type="number"></label>
        <label>Label<input v-model="state.state" placeholder="Full"></label>
        <label>Tone
          <select v-model="state.tone">
            <option v-for="tone in TONES" :key="tone" :value="tone">{{ tone }}</option>
          </select>
        </label>
      </div>
      <button type="button" class="sm danger-outline" @click="entry.displayStates.splice(index, 1)">
        <BuilderBtnIcon name="remove" />
        Remove
      </button>
    </article>
  </section>

  <section v-if="isMeter()" class="field-panel">
    <div class="section-heading">
      <h4>Thresholds</h4>
      <button type="button" class="sm add-btn" @click="addThreshold">
        <BuilderBtnIcon name="add" />
        Add threshold
      </button>
    </div>
    <p class="hint">
      Internal bands that can apply hourly effects while the stat is at or
      below this value.
    </p>
    <article
      v-for="(threshold, index) in (entry.thresholds ?? [])"
      :key="index"
      class="editor-card">
      <div class="field-grid">
        <label>At or below<input v-model.number="threshold.at" type="number"></label>
        <label>State id<input v-model="threshold.state" placeholder="hungry"></label>
      </div>
      <div class="section-heading">
        <h5>Hourly effects</h5>
        <button type="button" class="sm add-btn" @click="addThresholdEffect(threshold)">
          <BuilderBtnIcon name="add" />
          Add effect
        </button>
      </div>
      <div
        v-for="(effect, effectIndex) in (threshold.effectsPerGameHour ?? [])"
        :key="effectIndex"
        class="condition-row">
        <select v-model="effect.op">
          <option value="stat.add">stat.add</option>
          <option value="stat.set">stat.set</option>
        </select>
        <select v-model="effect.id">
          <option v-for="stat in draft.stats" :key="stat.id" :value="stat.id">
            {{ stat.label || stat.id }}
          </option>
        </select>
        <input v-model.number="effect.value" type="number" aria-label="Effect value">
        <button
          type="button"
          class="sm danger-outline"
          @click="threshold.effectsPerGameHour.splice(effectIndex, 1)">
          <BuilderBtnIcon name="remove" />
          Remove
        </button>
      </div>
      <button type="button" class="sm danger-outline" @click="entry.thresholds.splice(index, 1)">
        <BuilderBtnIcon name="remove" />
        Remove threshold
      </button>
    </article>
  </section>
</template>

<style scoped>
.hint {
  margin: 0;
  color: #8f98a6;
  font-size: 0.78rem;
  line-height: 1.4;
}
.editor-card {
  display: grid;
  gap: 0.65rem;
  padding: 0.7rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #202733;
}
h5 {
  margin: 0;
  color: #d7dde6;
  font-size: 0.76rem;
}
.condition-row {
  display: grid;
  grid-template-columns: minmax(7rem, 0.8fr) minmax(8rem, 1.2fr) 5.5rem auto;
  gap: 0.45rem;
  align-items: end;
}
@media (max-width: 720px) {
  .condition-row {
    grid-template-columns: 1fr;
  }
}
</style>
