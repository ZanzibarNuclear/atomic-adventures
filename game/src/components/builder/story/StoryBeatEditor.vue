<script setup>
import { computed, ref, watch } from "vue";
import RevisionHistoryPanel from "../RevisionHistoryPanel.vue";
import StoryChoiceEditor from "./StoryChoiceEditor.vue";

const props = defineProps({
  draft: { type: Object, default: null },
  dirty: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false },
  status: { type: String, default: "" },
  errors: { type: Object, default: () => ({}) },
  catalog: { type: Object, required: true },
  draftIsOutdoorHexBeat: { type: Boolean, default: false },
  showRevisions: { type: Boolean, default: false },
  revisions: { type: Array, default: () => [] },
  destinationType: { type: Function, required: true },
  selectedLocation: { type: String, default: "" },
  originHexOptions: { type: Array, default: () => [] },
  milestones: { type: Array, default: () => [] },
  flagIds: { type: Array, default: () => [] },
});

defineEmits([
  "save",
  "revert",
  "duplicate",
  "history",
  "delete",
  "add-choice",
  "move-choice",
  "remove-choice",
  "set-csv",
  "set-destination-type",
  "set-view-kind",
  "restore-revision",
  "new-milestone",
  "set-milestone",
]);

const activeTab = ref("story");
const selectedOriginHex = ref("");
const editingLocationCriteria = ref(false);
const editingFlagCriteria = ref(false);
const editingTimeCriteria = ref(false);

const selectedOriginHexes = computed(() =>
  Array.isArray(props.draft?.match?.originHex)
    ? props.draft.match.originHex
    : props.draft?.match?.originHex
      ? [props.draft.match.originHex]
      : [],
);

const availableOriginHexOptions = computed(() => {
  const selected = new Set(selectedOriginHexes.value);
  return props.originHexOptions.filter((hex) => !selected.has(hex.id));
});

const locationCriteriaSummary = computed(() => {
  if (!props.draft) return [];
  const match = props.draft.match ?? {};
  const summary = [];
  if (selectedOriginHexes.value.length) {
    summary.push(`Origin: ${selectedOriginHexes.value.map(hexLabel).join(", ")}`);
  }
  if (match.mapTransition) {
    summary.push(`Map transition: ${transitionLabel(match.mapTransition)}`);
  }
  if (match.transitionDirection) {
    summary.push(`Direction: ${directionLabel(match.transitionDirection)}`);
  }
  return summary;
});

const timeCriteriaSummary = computed(() => {
  if (!props.draft) return [];
  const time = props.draft.time ?? {};
  const summary = [];
  if (Array.isArray(time.days) && time.days.length) summary.push(`Day #: ${time.days.join(", ")}`);
  if (time.dayFrom != null) summary.push(`Day from: ${time.dayFrom}`);
  if (time.dayTo != null) summary.push(`Day to: ${time.dayTo}`);
  if (time.phase) summary.push(`Time of day: ${time.phase}`);
  if (time.elapsedFrom != null) summary.push(`Elapsed from: ${time.elapsedFrom}`);
  if (time.elapsedTo != null) summary.push(`Elapsed to: ${time.elapsedTo}`);
  if (time.afterMilestone) summary.push(`After: ${time.afterMilestone}`);
  if (time.beforeMilestone) summary.push(`Before: ${time.beforeMilestone}`);
  return summary;
});

const flagCriteriaSummary = computed(() => {
  if (!props.draft) return [];
  const flags = props.draft.conditions?.flags ?? {};
  const summary = [];
  if (Array.isArray(flags.all) && flags.all.length) summary.push(`Requires: ${flags.all.join(", ")}`);
  if (Array.isArray(flags.not) && flags.not.length) summary.push(`Absent: ${flags.not.join(", ")}`);
  return summary;
});

const modeCriteriaSummary = computed(() => {
  if (!props.draft) return [];
  const summary = [];
  const modes = Array.isArray(props.draft.modes) ? props.draft.modes : [];
  if (modes.length) summary.push(`Modes: ${modes.map(modeLabel).join(", ")}`);
  if (props.draft.storyBeat) summary.push(`Story beat: ${props.draft.storyBeat}`);
  return summary;
});

watch(
  () => props.selectedLocation,
  () => {
    activeTab.value = "story";
    selectedOriginHex.value = "";
    editingLocationCriteria.value = false;
    editingFlagCriteria.value = false;
    editingTimeCriteria.value = false;
  },
);

watch(
  () => props.draft,
  () => {
    selectedOriginHex.value = "";
    editingLocationCriteria.value = false;
    editingFlagCriteria.value = false;
    editingTimeCriteria.value = false;
  },
);

function fieldError(path) {
  return props.errors[path]?.join(" ");
}

function setDayList(event) {
  props.draft.time.days = event.target.value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function setFlagList(group, event) {
  props.draft.conditions ??= {};
  props.draft.conditions.flags ??= { all: [], not: [] };
  props.draft.conditions.flags[group] = event.target.value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function milestoneLabel(id) {
  const milestone = props.milestones.find((item) => item.id === id);
  return milestone ? `${milestone.label} (${milestone.id})` : id;
}

function ensureOriginHexList() {
  props.draft.match.originHex = selectedOriginHexes.value;
}

function addOriginHex() {
  const id = selectedOriginHex.value;
  if (!id) return;
  ensureOriginHexList();
  if (!props.draft.match.originHex.includes(id)) {
    props.draft.match.originHex = [...props.draft.match.originHex, id];
  }
  selectedOriginHex.value = "";
}

function removeOriginHex(id) {
  ensureOriginHexList();
  props.draft.match.originHex = props.draft.match.originHex.filter((originId) => originId !== id);
}

function hexLabel(id) {
  const hex = props.catalog.world.hexes.find((item) => item.id === id);
  return hex ? `${hex.label} (${hex.id})` : id;
}

function transitionLabel(id) {
  const transition = (props.catalog.world.mapTransitions ?? []).find((item) => item.id === id);
  return transition ? `${transition.label} (${transition.id})` : id;
}

function directionLabel(value) {
  if (value === "toLocal") return "To local map";
  if (value === "toRegional") return "To regional map";
  return value;
}

function modeLabel(value) {
  if (value === "story") return "Story";
  if (value === "open-world") return "Open-world";
  return value;
}

function modeEnabled(mode) {
  return Array.isArray(props.draft?.modes) && props.draft.modes.includes(mode);
}

function setModeEnabled(mode, enabled) {
  if (!props.draft) return;
  const current = new Set(Array.isArray(props.draft.modes) ? props.draft.modes : []);
  if (enabled) current.add(mode);
  else current.delete(mode);
  props.draft.modes = [...current];
}
</script>

<template>
  <section class="builder-form-column panel">
    <div v-if="!draft" class="empty-editor">
      Select a scene or create a new one.
    </div>
    <form v-else @submit.prevent="$emit('save')">
      <div class="form-toolbar">
        <div>
          <span v-if="dirty" class="dirty-pill">Unsaved</span>
          <span v-else class="saved-pill">Saved</span>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="sm muted" :disabled="!dirty" @click="$emit('revert')">Revert</button>
          <button type="button" class="sm muted" @click="$emit('duplicate', draft)">Duplicate</button>
          <button type="button" class="sm muted" :disabled="isNew" @click="$emit('history')">History</button>
          <button type="submit" class="sm" :disabled="!dirty">Save</button>
        </div>
      </div>

      <p v-if="status" class="builder-status">{{ status }}</p>
      <p v-for="message in errors.trigger ?? []" :key="message" class="field-error">{{ message }}</p>

      <div class="editor-tabs" role="tablist" aria-label="Scene editor sections">
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'story' }"
          role="tab"
          :aria-selected="activeTab === 'story'"
          @click="activeTab = 'story'"
        >
          Scene
        </button>
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'criteria' }"
          role="tab"
          :aria-selected="activeTab === 'criteria'"
          @click="activeTab = 'criteria'"
        >
          Criteria
        </button>
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'choices' }"
          role="tab"
          :aria-selected="activeTab === 'choices'"
          @click="activeTab = 'choices'"
        >
          Choices
        </button>
      </div>

      <div v-show="activeTab === 'story'" class="tab-panel" role="tabpanel">
        <div class="field-grid">
          <label>Scene ID
            <input v-model="draft.id" />
            <span v-if="fieldError('id')" class="field-error">{{ fieldError("id") }}</span>
          </label>
          <label>Eyebrow<input v-model="draft.eyebrow" /></label>
          <label>Heading<input v-model="draft.heading" /></label>
        </div>

        <label>Scene prose
          <textarea v-model="draft.text" rows="10" />
          <span v-if="fieldError('text')" class="field-error">{{ fieldError("text") }}</span>
        </label>
        <label>Revisit prose<textarea v-model="draft.revisit" rows="5" /></label>
      </div>

      <div v-show="activeTab === 'criteria'" class="tab-panel" role="tabpanel">
        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Mode and story beat</h3>
          </div>
          <div class="criteria-readonly">
            <span
              v-for="item in modeCriteriaSummary"
              :key="item"
              class="summary-chip"
            >
              {{ item }}
            </span>
            <p v-if="!modeCriteriaSummary.length" class="empty-origin-list">Default: both play modes.</p>
          </div>
          <div class="mode-grid">
            <label class="check-row">
              <input
                type="checkbox"
                :checked="modeEnabled('story')"
                @change="setModeEnabled('story', $event.target.checked)"
              />
              Story mode
            </label>
            <label class="check-row">
              <input
                type="checkbox"
                :checked="modeEnabled('open-world')"
                @change="setModeEnabled('open-world', $event.target.checked)"
              />
              Open-world mode
            </label>
            <label class="span-all">Story beat
              <input
                v-model="draft.storyBeat"
                placeholder="optional story beat ID"
              />
              <span v-if="fieldError('storyBeat')" class="field-error">{{ fieldError("storyBeat") }}</span>
            </label>
          </div>
        </section>

        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Location based</h3>
            <button
              type="button"
              class="sm muted"
              @click="editingLocationCriteria = !editingLocationCriteria"
            >
              {{ editingLocationCriteria ? "Done" : "Edit" }}
            </button>
          </div>

          <div v-if="!editingLocationCriteria" class="criteria-readonly">
            <span
              v-for="item in locationCriteriaSummary"
              :key="item"
              class="summary-chip"
            >
              {{ item }}
            </span>
            <p v-if="!locationCriteriaSummary.length" class="empty-origin-list">No location criteria.</p>
          </div>

          <div v-else class="field-grid">
            <label v-if="draftIsOutdoorHexBeat" class="span-all">Origin hexes
              <div class="origin-picker">
                <div v-if="selectedOriginHexes.length" class="selected-origin-list">
                  <span v-for="hexId in selectedOriginHexes" :key="hexId" class="origin-chip">
                    {{ hexLabel(hexId) }}
                    <button type="button" class="chip-remove" :aria-label="`Remove origin hex ${hexId}`" @click="removeOriginHex(hexId)">x</button>
                  </span>
                </div>
                <p v-else class="empty-origin-list">Default: any adjacent origin.</p>
                <div class="origin-add-row">
                  <select v-model="selectedOriginHex">
                    <option value="">Specify an origin...</option>
                    <option v-for="hex in availableOriginHexOptions" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
                  </select>
                  <button type="button" class="sm" :disabled="!selectedOriginHex" @click="addOriginHex">Add</button>
                </div>
              </div>
              <span v-if="fieldError('match.originHex')" class="field-error">{{ fieldError("match.originHex") }}</span>
            </label>
            <label>Map transition
              <select v-model="draft.match.mapTransition">
                <option :value="null">Default</option>
                <option
                  v-for="transition in catalog.world.mapTransitions"
                  :key="transition.id"
                  :value="transition.id"
                >
                  {{ transition.label }} ({{ transition.id }})
                </option>
              </select>
              <span v-if="fieldError('match.mapTransition')" class="field-error">{{ fieldError("match.mapTransition") }}</span>
            </label>
            <label>Transition direction
              <select v-model="draft.match.transitionDirection">
                <option :value="null">Any direction</option>
                <option value="toLocal">To local map</option>
                <option value="toRegional">To regional map</option>
              </select>
              <span v-if="fieldError('match.transitionDirection')" class="field-error">{{ fieldError("match.transitionDirection") }}</span>
            </label>
          </div>
        </section>

        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Flag based</h3>
            <button
              type="button"
              class="sm muted"
              @click="editingFlagCriteria = !editingFlagCriteria"
            >
              {{ editingFlagCriteria ? "Done" : "Edit" }}
            </button>
          </div>

          <div v-if="!editingFlagCriteria" class="criteria-readonly">
            <span
              v-for="item in flagCriteriaSummary"
              :key="item"
              class="summary-chip"
            >
              {{ item }}
            </span>
            <p v-if="!flagCriteriaSummary.length" class="empty-origin-list">No flag criteria.</p>
          </div>

          <div v-else class="field-grid">
            <label>Required flags
              <input
                :value="(draft.conditions?.flags?.all ?? []).join(', ')"
                list="story-flag-ids"
                placeholder="gate.inspected"
                @input="setFlagList('all', $event)"
              />
              <span v-if="fieldError('conditions.flags.all')" class="field-error">{{ fieldError("conditions.flags.all") }}</span>
            </label>
            <label>Absent flags
              <input
                :value="(draft.conditions?.flags?.not ?? []).join(', ')"
                list="story-flag-ids"
                placeholder="gate.opened"
                @input="setFlagList('not', $event)"
              />
              <span v-if="fieldError('conditions.flags.not')" class="field-error">{{ fieldError("conditions.flags.not") }}</span>
            </label>
            <datalist id="story-flag-ids">
              <option v-for="flag in flagIds" :key="flag" :value="flag" />
            </datalist>
          </div>
        </section>

        <section class="criteria-card">
          <div class="criteria-card-header">
            <h3>Time based</h3>
            <button
              type="button"
              class="sm muted"
              @click="editingTimeCriteria = !editingTimeCriteria"
            >
              {{ editingTimeCriteria ? "Done" : "Edit" }}
            </button>
          </div>

          <div v-if="!editingTimeCriteria" class="criteria-readonly">
            <span
              v-for="item in timeCriteriaSummary"
              :key="item"
              class="summary-chip"
            >
              {{ item }}
            </span>
            <p v-if="!timeCriteriaSummary.length" class="empty-origin-list">No time criteria.</p>
          </div>

          <div v-else class="field-grid">
            <label>Day #
              <input
                :value="draft.time.days.join(', ')"
                placeholder="1, 2"
                @input="setDayList"
              />
              <span v-if="fieldError('time.days')" class="field-error">{{ fieldError("time.days") }}</span>
            </label>
            <label>Time of day
              <select v-model="draft.time.phase">
                <option :value="null">Any</option>
                <option value="morning">morning</option>
                <option value="afternoon">afternoon</option>
                <option value="evening">evening</option>
                <option value="night">night</option>
              </select>
              <span v-if="fieldError('time.phase')" class="field-error">{{ fieldError("time.phase") }}</span>
            </label>
            <label>After milestone
              <select
                :value="draft.time.afterMilestone ?? ''"
                @change="$event.target.value === '__new__' ? $emit('new-milestone', { field: 'afterMilestone' }) : $emit('set-milestone', { field: 'afterMilestone', value: $event.target.value || null })"
              >
                <option value="">Any</option>
                <option v-for="milestone in milestones" :key="milestone.id" :value="milestone.id">
                  {{ milestone.label }} ({{ milestone.id }})
                </option>
                <option value="__new__">New milestone...</option>
              </select>
              <span v-if="draft.time.afterMilestone && !milestones.some((item) => item.id === draft.time.afterMilestone)" class="field-hint">
                {{ milestoneLabel(draft.time.afterMilestone) }}
              </span>
            </label>
            <label>Before milestone
              <select
                :value="draft.time.beforeMilestone ?? ''"
                @change="$event.target.value === '__new__' ? $emit('new-milestone', { field: 'beforeMilestone' }) : $emit('set-milestone', { field: 'beforeMilestone', value: $event.target.value || null })"
              >
                <option value="">Any</option>
                <option v-for="milestone in milestones" :key="milestone.id" :value="milestone.id">
                  {{ milestone.label }} ({{ milestone.id }})
                </option>
                <option value="__new__">New milestone...</option>
              </select>
              <span v-if="draft.time.beforeMilestone && !milestones.some((item) => item.id === draft.time.beforeMilestone)" class="field-hint">
                {{ milestoneLabel(draft.time.beforeMilestone) }}
              </span>
            </label>
          </div>
        </section>
      </div>

      <div v-show="activeTab === 'choices'" class="tab-panel" role="tabpanel">
        <fieldset>
          <legend>Scene choices</legend>
          <StoryChoiceEditor
            v-for="(choice, index) in draft.choices"
            :key="choice.id"
            :choice="choice"
            :index="index"
            :catalog="catalog"
            :errors="errors"
            :destination-type="destinationType"
            :flag-ids="flagIds"
            @move="$emit('move-choice', { index, delta: $event })"
            @remove="$emit('remove-choice', index)"
            @set-csv="$emit('set-csv', $event)"
            @set-destination-type="$emit('set-destination-type', $event)"
            @set-view-kind="$emit('set-view-kind', $event)"
          />
          <button type="button" class="sm" @click="$emit('add-choice')">Add choice</button>
        </fieldset>
      </div>

      <RevisionHistoryPanel
        class="revision-panel"
        :visible="showRevisions"
        title="Revision history"
        :revisions="revisions"
        @restore="$emit('restore-revision', $event)"
      />

      <button v-if="!isNew" type="button" class="danger" @click="$emit('delete')">Delete scene</button>
    </form>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid #343d4d;
  border-radius: 12px;
  background: #20252f;
  padding: 1rem;
  min-width: 0;
}

.builder-form-column form,
.tab-panel,
fieldset {
  display: grid;
  gap: 0.8rem;
}

.form-toolbar,
.toolbar-actions,
.editor-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.editor-tabs {
  justify-content: flex-start;
  gap: 0.35rem;
  padding: 0.25rem;
  border: 1px solid #343d4d;
  border-radius: 9px;
  background: #171b22;
}

.editor-tabs button {
  border-color: transparent;
  background: transparent;
  color: #b8c0cc;
}

.editor-tabs button.active {
  border-color: #6f9b79;
  background: #49624f;
  color: #eef7ef;
}

label {
  display: grid;
  gap: 0.35rem;
  color: #bfc5cf;
  font-size: 0.82rem;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: 0.5rem 0.6rem;
  font: inherit;
}

textarea {
  resize: vertical;
  line-height: 1.5;
}

.criteria-card {
  display: grid;
  gap: 0.75rem;
  border: 1px solid #3b4557;
  border-radius: 8px;
  background: #1b2029;
  padding: 0.85rem;
}

.criteria-card-header,
.criteria-readonly {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.criteria-card-header {
  justify-content: space-between;
}

.criteria-card-header h3 {
  margin: 0;
  color: #e5ecf5;
  font-size: 0.98rem;
}

.criteria-readonly {
  flex-wrap: wrap;
  min-width: 0;
}

.summary-chip {
  border: 1px solid #465268;
  border-radius: 999px;
  background: #171b22;
  color: #c9d1dc;
  padding: 0.15rem 0.45rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid #3d485b;
  border-radius: 7px;
  background: #171b22;
  padding: 0.5rem 0.6rem;
}
.check-row input {
  width: auto;
}

.span-all {
  grid-column: 1 / -1;
}

.origin-picker {
  display: grid;
  gap: 0.55rem;
}

.selected-origin-list,
.origin-add-row {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  align-items: center;
}

.origin-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
}

.origin-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #526072;
  border-radius: 999px;
  background: #242c38;
  color: #eef1f5;
  padding: 0.25rem 0.3rem 0.25rem 0.6rem;
}

.chip-remove {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  padding: 0;
  display: inline-grid;
  place-items: center;
  line-height: 1;
}

.empty-origin-list {
  margin: 0;
  color: #9aa4b5;
  font-size: 0.8rem;
}

fieldset {
  border: 1px solid #3b4557;
  border-radius: 9px;
  padding: 0.85rem;
}

legend {
  color: #8bc49a;
  padding: 0 0.35rem;
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

.builder-status {
  color: #9fc7ff;
  margin: 0;
}

.field-error {
  color: #ff9e9e;
  font-size: 0.78rem;
  margin: 0.2rem 0 0;
}

.field-hint {
  color: #aeb5c0;
  font-size: 0.78rem;
  margin: 0.2rem 0 0;
}

.revision-panel {
  display: grid;
  gap: 0.4rem;
}

.danger {
  margin-top: 1rem;
  background: #5a2929;
  border-color: #854141;
}

.empty-editor {
  color: #9aa0ac;
  padding: 3rem 1rem;
  text-align: center;
}

@media (max-width: 720px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
  .mode-grid {
    grid-template-columns: 1fr;
  }

  .origin-add-row {
    grid-template-columns: 1fr;
  }
}
</style>
