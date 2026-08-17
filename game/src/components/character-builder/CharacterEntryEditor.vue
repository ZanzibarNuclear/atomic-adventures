<script setup>
import { ref, watch } from "vue";
import BuilderBtnIcon from "../builder/BuilderBtnIcon.vue";
import CharacterEntrySummary from "./CharacterEntrySummary.vue";
import ItemFields from "./ItemFields.vue";
import QuestFields from "./QuestFields.vue";
import SkillFields from "./SkillFields.vue";
import StatFields from "./StatFields.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selectedCatalog: { type: String, required: true },
  selectedEntry: { type: Object, default: null },
  pendingEditId: { type: String, default: "" },
  errorMessages: { type: Array, required: true },
  warnings: { type: Array, required: true },
  showHistory: { type: Boolean, required: true },
  revisions: { type: Array, required: true },
  visibilityOptions: { type: Array, required: true },
  labelize: { type: Function, required: true },
  setCsv: { type: Function, required: true },
  setOptionalNumber: { type: Function, required: true },
  setJson: { type: Function, required: true },
});

const emit = defineEmits([
  "clear-pending-edit",
  "delete-entry",
  "duplicate-entry",
  "move-entry",
  "rename-entry",
  "restore-revision",
]);

const editing = ref(false);

watch(
  () => props.selectedEntry?.id,
  (id) => {
    editing.value = Boolean(id && id === props.pendingEditId);
    if (editing.value) emit("clear-pending-edit");
  },
  { immediate: true },
);

function beginEdit() {
  editing.value = true;
}

function finishEdit() {
  editing.value = false;
}
</script>

<template>
  <section class="entry-editor panel" :class="{ editing }">
    <template v-if="selectedEntry">
      <div class="entry-heading">
        <div>
          <p class="label">{{ selectedCatalog }}</p>
          <h3>{{ selectedEntry.label ?? selectedEntry.title ?? selectedEntry.id }}</h3>
          <p class="entry-id">{{ selectedEntry.id }}</p>
        </div>
        <div class="toolbar-actions">
          <button v-if="!editing" type="button" class="sm edit-btn" @click="beginEdit">
            <BuilderBtnIcon name="edit" />
            Edit
          </button>
          <button v-else type="button" class="sm success-btn" @click="finishEdit">
            <BuilderBtnIcon name="check" />
            Done
          </button>
          <button type="button" class="sm muted" title="Move up" @click="$emit('move-entry', -1)">
            <BuilderBtnIcon name="up" />
            Up
          </button>
          <button type="button" class="sm muted" title="Move down" @click="$emit('move-entry', 1)">
            <BuilderBtnIcon name="down" />
            Down
          </button>
          <button type="button" class="sm muted" @click="$emit('rename-entry')">
            Rename
          </button>
          <button type="button" class="sm muted" @click="$emit('duplicate-entry')">
            <BuilderBtnIcon name="duplicate" />
            Duplicate
          </button>
          <button type="button" class="sm danger-outline" @click="$emit('delete-entry')">
            <BuilderBtnIcon name="remove" />
            Delete
          </button>
        </div>
      </div>

      <CharacterEntrySummary
        v-if="!editing"
        :draft="draft"
        :catalog="selectedCatalog"
        :entry="selectedEntry" />

      <template v-else>
        <section class="form-section">
          <div class="section-heading">
            <h4>Core fields</h4>
            <code>{{ selectedEntry.id }}</code>
          </div>
          <label v-if="selectedCatalog !== 'documents'">Label<input v-model="selectedEntry.label"></label>
          <label v-else>Title<input v-model="selectedEntry.title"></label>
          <label v-if="'description' in selectedEntry">
            Description<textarea v-model="selectedEntry.description" rows="4"></textarea>
          </label>
        </section>

        <ItemFields
          v-if="selectedCatalog === 'items'"
          :draft="draft"
          :entry="selectedEntry"
          :visibility-options="visibilityOptions"
          :set-json="setJson" />

        <StatFields
          v-else-if="selectedCatalog === 'stats'"
          :draft="draft"
          :entry="selectedEntry"
          :set-optional-number="setOptionalNumber" />

        <SkillFields
          v-else-if="selectedCatalog === 'skills'"
          :draft="draft"
          :entry="selectedEntry" />

        <QuestFields
          v-else-if="selectedCatalog === 'quests'"
          :entry="selectedEntry" />

        <div v-if="selectedCatalog !== 'items'" class="field-grid">
          <label v-if="'order' in selectedEntry">Order<input v-model.number="selectedEntry.order" type="number"></label>
          <label>Visibility
            <select v-model="selectedEntry.visible">
              <option v-for="visibility in visibilityOptions" :key="visibility">{{ visibility }}</option>
            </select>
          </label>
        </div>

        <div class="form-footer">
          <button type="button" class="sm success-btn" @click="finishEdit">
            <BuilderBtnIcon name="check" />
            Done
          </button>
        </div>
      </template>
    </template>
    <p v-else class="empty-note">Choose or add an entry.</p>

    <p v-for="message in errorMessages.slice(0, 16)" :key="message" class="field-error">
      {{ message }}
    </p>
    <p v-for="warning in warnings" :key="`${warning.path}:${warning.message}`" class="warning">
      {{ warning.path }}: {{ warning.message }}
    </p>

    <section v-if="showHistory" class="history">
      <h3>Character revisions</h3>
      <button
        v-for="revision in revisions"
        :key="revision.revision"
        class="revision-item"
        @click="$emit('restore-revision', revision.revision)">
        r{{ revision.revision }} &middot; {{ revision.operation }} &middot;
        {{ new Date(revision.createdAt).toLocaleString() }}
      </button>
    </section>
  </section>
</template>

<style scoped>
.panel { padding: .85rem; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; }
.entry-editor { display: grid; gap: .75rem; max-height: calc(100vh - 10.7rem); overflow: auto; }
.entry-heading,
.toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.entry-heading h3,
.entry-heading p { margin: 0; }
.entry-editor.editing {
  border-color: color-mix(in srgb, var(--color-cherenkov, #20c8fb) 35%, #343d4d);
}
.entry-heading h3 {
  color: #eef1f5;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.entry-id {
  margin: 0.15rem 0 0;
  color: #8f98a6;
  font-size: 0.78rem;
}
.form-footer {
  display: flex;
  justify-content: flex-end;
}
.form-section,
:deep(.tab-panel),
:deep(.field-panel) {
  display: grid;
  gap: .75rem;
  padding: .75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.section-heading,
:deep(.section-heading) {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .65rem;
}
.section-heading h4,
:deep(.section-heading h4) {
  margin: 0;
  color: #d7dde6;
  font-size: .78rem;
  font-weight: 700;
}
.section-heading code,
:deep(.section-heading code) {
  min-width: 0;
  color: #9da7b5;
  font-size: .74rem;
  overflow-wrap: anywhere;
}
label,
:deep(label) { display: grid; gap: .35rem; color: #bdc4ce; font-size: .8rem; }
input,
textarea,
select,
:deep(input),
:deep(textarea),
:deep(select) {
  width: 100%;
  min-width: 0;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .5rem .6rem;
  font: inherit;
}
input:focus,
textarea:focus,
select:focus,
:deep(input:focus),
:deep(textarea:focus),
:deep(select:focus) {
  outline: 2px solid #6ea57b;
  outline-offset: 1px;
  border-color: #6ea57b;
}
textarea,
:deep(textarea) {
  resize: vertical;
  line-height: 1.5;
}
.field-grid,
:deep(.field-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .7rem;
}
:deep(.check-field) {
  display: flex !important;
  align-items: center;
  gap: .45rem;
}
:deep(.check-field input) { width: auto; }
.field-error { color: #e88c8c; }
.warning { color: #d7b66d; }
.history {
  display: grid;
  gap: .45rem;
  margin-top: 1rem;
  padding: .75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.revision-item {
  width: 100%;
  padding: .45rem .55rem;
  border-color: #394457;
  border-radius: 7px;
  background: #202733;
  text-align: left;
}
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
@media (max-width: 720px) {
  .entry-editor { max-height: none; }
  .field-grid,
  :deep(.field-grid) { grid-template-columns: 1fr; }
}
</style>
