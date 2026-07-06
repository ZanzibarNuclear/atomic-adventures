<script setup>
import { computed } from "vue";

const props = defineProps({
  documentText: { type: String, default: "" },
  dirty: { type: Boolean, default: false },
  status: { type: String, default: "" },
  errors: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:documentText", "save", "revert", "reload"]);

const parsed = computed(() => {
  try {
    return JSON.parse(props.documentText || "{}");
  } catch {
    return null;
  }
});

const scenarios = computed(() => Array.isArray(parsed.value?.scenarios) ? parsed.value.scenarios : []);
const parseError = computed(() => parsed.value ? "" : "Storyline JSON is not valid.");

function errorEntries(errors) {
  return Object.entries(errors ?? {}).flatMap(([path, messages]) =>
    (Array.isArray(messages) ? messages : [messages]).map((message) => ({ path, message })),
  );
}
</script>

<template>
  <section class="scenario-panel">
    <div class="scenario-summary panel">
      <div class="scenario-heading">
        <div>
          <p class="label">Storyline</p>
          <h2>Scenarios</h2>
        </div>
        <div class="scenario-actions">
          <span v-if="dirty" class="dirty-pill">Unsaved</span>
          <span v-else class="saved-pill">Saved</span>
          <button type="button" class="sm muted" @click="$emit('reload')">Reload</button>
        </div>
      </div>
      <p v-if="status" class="builder-status">{{ status }}</p>
      <p v-if="parseError" class="field-error">{{ parseError }}</p>
      <ul v-if="scenarios.length" class="scenario-list">
        <li v-for="scenario in scenarios" :key="scenario.id" class="scenario-card">
          <div>
            <strong>{{ scenario.label || scenario.id }}</strong>
            <span>{{ scenario.id }}</span>
          </div>
          <dl>
            <div>
              <dt>Start</dt>
              <dd>{{ scenario.startStep || "none" }}</dd>
            </div>
            <div>
              <dt>Steps</dt>
              <dd>{{ scenario.steps?.length ?? 0 }}</dd>
            </div>
          </dl>
          <ol v-if="scenario.steps?.length" class="step-list">
            <li v-for="step in scenario.steps" :key="step.id">
              <span>{{ step.id }}</span>
              <small>{{ step.objective }}</small>
            </li>
          </ol>
        </li>
      </ul>
      <p v-else class="empty-note">No scenarios found in this document.</p>
    </div>

    <form class="scenario-editor panel" @submit.prevent="$emit('save')">
      <div class="scenario-heading">
        <div>
          <p class="label">Trusted local editor</p>
          <h2>Document JSON</h2>
        </div>
        <div class="scenario-actions">
          <button type="button" class="sm muted" :disabled="!dirty" @click="$emit('revert')">Revert</button>
          <button type="submit" class="sm" :disabled="!dirty || Boolean(parseError)">Save</button>
        </div>
      </div>
      <textarea
        :value="documentText"
        rows="26"
        spellcheck="false"
        @input="$emit('update:documentText', $event.target.value)"
      />
      <div v-if="errorEntries(errors).length" class="validation-list">
        <p v-for="entry in errorEntries(errors)" :key="`${entry.path}:${entry.message}`" class="field-error">
          <strong>{{ entry.path }}</strong>: {{ entry.message }}
        </p>
      </div>
    </form>
  </section>
</template>

<style scoped>
.scenario-panel {
  display: grid;
  grid-template-columns: minmax(320px, 0.75fr) minmax(480px, 1.25fr);
  gap: 1rem;
  height: calc(100% - 3rem);
  min-height: 0;
  margin-top: 0.75rem;
}
.panel {
  min-height: 0;
  overflow: auto;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #20252f;
  padding: 1rem;
}
.scenario-heading,
.scenario-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}
.scenario-actions {
  justify-content: flex-end;
}
h2,
p {
  margin: 0;
}
.label {
  color: #8e96a3;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.builder-status {
  color: #9fc7ff;
  margin-top: 0.75rem;
}
.scenario-list,
.step-list {
  display: grid;
  gap: 0.7rem;
  padding: 0;
  margin: 1rem 0 0;
  list-style: none;
}
.scenario-card {
  display: grid;
  gap: 0.55rem;
  border: 1px solid #3d485b;
  border-radius: 8px;
  background: #1b2029;
  padding: 0.75rem;
}
.scenario-card strong,
.scenario-card span,
.step-list span {
  display: block;
}
.scenario-card span,
.step-list small,
.empty-note {
  color: #9aa4b5;
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}
dl div {
  border: 1px solid #354052;
  border-radius: 7px;
  padding: 0.45rem;
}
dt {
  color: #8e96a3;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
dd {
  margin: 0.15rem 0 0;
}
.step-list li {
  border-top: 1px solid #313a49;
  padding-top: 0.5rem;
}
textarea {
  width: 100%;
  min-height: 0;
  margin-top: 0.85rem;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: 0.75rem;
  font: 0.82rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  resize: vertical;
}
.dirty-pill,
.saved-pill {
  border-radius: 99px;
  padding: 0.25rem 0.55rem;
  font-size: 0.75rem;
}
.dirty-pill {
  background: #6d5625;
  color: #ffe19a;
}
.saved-pill {
  background: #294d35;
  color: #bce8c7;
}
.field-error {
  color: #ff9e9e;
  font-size: 0.78rem;
}
.validation-list {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.75rem;
}
@media (max-width: 900px) {
  .scenario-panel {
    grid-template-columns: 1fr;
  }
}
</style>
