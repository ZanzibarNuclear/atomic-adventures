<script setup>
import { watch } from "vue";
import BuilderBtnIcon from "../builder/BuilderBtnIcon.vue";

const VISIBILITY = ["always", "when-acquired", "when-started", "hidden"];

const props = defineProps({
  entry: { type: Object, required: true },
});

watch(
  () => props.entry,
  (entry) => {
    entry.objectives ??= [];
    if (entry.autoComplete == null) entry.autoComplete = false;
  },
  { immediate: true },
);

function addObjective() {
  const objectives = props.entry.objectives;
  const order = (objectives.at(-1)?.order ?? 0) + 10;
  objectives.push({
    id: uniqueId("objective", objectives),
    label: "",
    order,
    visible: "when-acquired",
    target: null,
  });
}

function removeObjective(index) {
  props.entry.objectives.splice(index, 1);
}

function moveObjective(index, delta) {
  const next = index + delta;
  const list = props.entry.objectives;
  if (next < 0 || next >= list.length) return;
  const [row] = list.splice(index, 1);
  list.splice(next, 0, row);
}

function setTarget(objective, raw) {
  objective.target = raw === "" ? null : Math.max(1, Number(raw) || 1);
}

function uniqueId(prefix, entries) {
  const used = new Set(entries.map((entry) => entry.id));
  let index = entries.length + 1;
  let id = `${prefix}-${index}`;
  while (used.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return id;
}
</script>

<template>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Quest rules</h4>
      <code>{{ (entry.objectives ?? []).length }} objectives</code>
    </div>
    <label class="check-field">
      <input v-model="entry.autoComplete" type="checkbox">
      Complete quest when every objective is complete
    </label>
    <label>Group
      <input v-model="entry.group" placeholder="main">
    </label>
  </section>

  <section class="field-panel">
    <div class="section-heading">
      <h4>Objectives</h4>
      <button type="button" class="sm add-btn" @click="addObjective">
        <BuilderBtnIcon name="add" />
        Add objective
      </button>
    </div>
    <p class="hint">
      Shown in the journal. A target is optional — use it for counted goals
      such as complete 3 operating rounds.
    </p>
    <article
      v-for="(objective, index) in (entry.objectives ?? [])"
      :key="index"
      class="editor-card">
      <div class="field-grid">
        <label>ID<input v-model="objective.id" placeholder="clear-intake"></label>
        <label>Label<input v-model="objective.label" placeholder="Clear debris from the intake"></label>
        <label>Order<input v-model.number="objective.order" type="number"></label>
        <label>Visibility
          <select v-model="objective.visible">
            <option v-for="option in VISIBILITY" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label>Count target
          <input
            :value="objective.target ?? ''"
            type="number"
            min="1"
            placeholder="none"
            @input="setTarget(objective, $event.target.value)">
        </label>
      </div>
      <div class="row-actions">
        <button type="button" class="sm muted" :disabled="index === 0" @click="moveObjective(index, -1)">
          <BuilderBtnIcon name="up" />
          Up
        </button>
        <button
          type="button"
          class="sm muted"
          :disabled="index === entry.objectives.length - 1"
          @click="moveObjective(index, 1)">
          <BuilderBtnIcon name="down" />
          Down
        </button>
        <button type="button" class="sm danger-outline" @click="removeObjective(index)">
          <BuilderBtnIcon name="remove" />
          Remove
        </button>
      </div>
    </article>
    <p v-if="!entry.objectives.length" class="hint">No objectives yet.</p>
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
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
