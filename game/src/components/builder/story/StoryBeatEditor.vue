<script setup>
import { ref, watch } from "vue";
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
]);

const activeTab = ref("story");

watch(
  () => props.selectedLocation,
  () => {
    activeTab.value = "story";
  },
);

function fieldError(path) {
  return props.errors[path]?.join(" ");
}
</script>

<template>
  <section class="builder-form-column panel">
    <div v-if="!draft" class="empty-editor">
      Select a beat or create a new one.
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

      <div class="editor-tabs" role="tablist" aria-label="Beat editor sections">
        <button
          type="button"
          class="sm"
          :class="{ active: activeTab === 'story' }"
          role="tab"
          :aria-selected="activeTab === 'story'"
          @click="activeTab = 'story'"
        >
          Story
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
          <label>Beat ID
            <input v-model="draft.id" />
            <span v-if="fieldError('id')" class="field-error">{{ fieldError("id") }}</span>
          </label>
          <label v-if="draftIsOutdoorHexBeat">Origin hex
            <select v-model="draft.match.originHex">
              <option :value="null">Default</option>
              <option v-for="hex in catalog.world.hexes" :key="hex.id" :value="hex.id">{{ hex.label }} ({{ hex.id }})</option>
            </select>
            <span v-if="fieldError('match.originHex')" class="field-error">{{ fieldError("match.originHex") }}</span>
          </label>
          <label v-if="draftIsOutdoorHexBeat">Local exit
            <select v-model="draft.match.localExit">
              <option :value="null">Default</option>
              <option v-for="exit in catalog.world.localExits" :key="exit.id" :value="exit.id">{{ exit.label }} ({{ exit.id }})</option>
            </select>
            <span v-if="fieldError('match.localExit')" class="field-error">{{ fieldError("match.localExit") }}</span>
          </label>
        </div>

        <div class="field-grid">
          <label>Eyebrow<input v-model="draft.eyebrow" /></label>
          <label>Heading<input v-model="draft.heading" /></label>
        </div>

        <label>Story text
          <textarea v-model="draft.text" rows="10" />
          <span v-if="fieldError('text')" class="field-error">{{ fieldError("text") }}</span>
        </label>
        <label>Revisit text<textarea v-model="draft.revisit" rows="5" /></label>
      </div>

      <div v-show="activeTab === 'choices'" class="tab-panel" role="tabpanel">
        <fieldset>
          <legend>Choices</legend>
          <StoryChoiceEditor
            v-for="(choice, index) in draft.choices"
            :key="choice.id"
            :choice="choice"
            :index="index"
            :catalog="catalog"
            :errors="errors"
            :destination-type="destinationType"
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

      <button v-if="!isNew" type="button" class="danger" @click="$emit('delete')">Delete beat</button>
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

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
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
}
</style>
