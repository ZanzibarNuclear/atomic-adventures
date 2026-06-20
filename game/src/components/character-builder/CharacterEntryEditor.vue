<script setup>
import ItemFields from "./ItemFields.vue";
import QuestFields from "./QuestFields.vue";
import SkillFields from "./SkillFields.vue";
import StatFields from "./StatFields.vue";

defineProps({
  draft: { type: Object, required: true },
  selectedCatalog: { type: String, required: true },
  selectedEntry: { type: Object, default: null },
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

defineEmits([
  "add-group",
  "delete-entry",
  "duplicate-entry",
  "move-entry",
  "remove-group",
  "rename-entry",
  "restore-revision",
]);
</script>

<template>
  <section class="entry-editor panel">
    <template v-if="selectedEntry">
      <div class="entry-heading">
        <div>
          <p class="label">{{ selectedCatalog }}</p>
          <h3>{{ selectedEntry.id }}</h3>
        </div>
        <div class="toolbar-actions">
          <button class="sm muted" @click="$emit('move-entry', -1)">&uarr;</button>
          <button class="sm muted" @click="$emit('move-entry', 1)">&darr;</button>
          <button class="sm muted" @click="$emit('rename-entry')">Rename</button>
          <button class="sm muted" @click="$emit('duplicate-entry')">Duplicate</button>
          <button class="sm danger-outline" @click="$emit('delete-entry')">Delete</button>
        </div>
      </div>

      <label v-if="selectedCatalog !== 'documents'">Label<input v-model="selectedEntry.label"></label>
      <label v-else>Title<input v-model="selectedEntry.title"></label>
      <label v-if="'description' in selectedEntry">
        Description<textarea v-model="selectedEntry.description" rows="4"></textarea>
      </label>

      <ItemFields
        v-if="selectedCatalog === 'items'"
        :draft="draft"
        :entry="selectedEntry"
        :set-csv="setCsv"
        :set-json="setJson" />

      <StatFields
        v-else-if="selectedCatalog === 'stats'"
        :draft="draft"
        :entry="selectedEntry"
        :set-json="setJson"
        :set-optional-number="setOptionalNumber" />

      <SkillFields
        v-else-if="selectedCatalog === 'skills'"
        :entry="selectedEntry"
        :set-csv="setCsv"
        :set-json="setJson" />

      <QuestFields
        v-if="selectedCatalog === 'quests'"
        :entry="selectedEntry"
        :set-json="setJson" />

      <div class="field-grid">
        <label v-if="'order' in selectedEntry">Order<input v-model.number="selectedEntry.order" type="number"></label>
        <label>Visibility
          <select v-model="selectedEntry.visible">
            <option v-for="visibility in visibilityOptions" :key="visibility">{{ visibility }}</option>
          </select>
        </label>
      </div>
    </template>
    <p v-else class="empty-note">Choose or add an entry.</p>

    <details class="group-editor">
      <summary>Panel groups</summary>
      <section>
        <h4>Stat groups</h4>
        <div v-for="group in draft.panel.statGroups" :key="group.id" class="group-row">
          <input v-model="group.id"><input v-model="group.label">
          <button class="sm muted" @click="$emit('remove-group', 'statGroups', group.id)">Remove</button>
        </div>
        <button class="sm" @click="$emit('add-group', 'statGroups')">Add stat group</button>
      </section>
      <section>
        <h4>Inventory groups</h4>
        <div v-for="group in draft.panel.inventoryGroups" :key="group.id" class="group-row">
          <input v-model="group.id"><input v-model="group.label">
          <button class="sm muted" @click="$emit('remove-group', 'inventoryGroups', group.id)">Remove</button>
        </div>
        <button class="sm" @click="$emit('add-group', 'inventoryGroups')">Add inventory group</button>
      </section>
    </details>

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
.panel { padding: .85rem; border: 1px solid #343d4d; border-radius: 10px; background: #1d222b; }
.entry-editor { display: grid; gap: .75rem; max-height: calc(100vh - 10.7rem); overflow: auto; }
.entry-heading,
.toolbar-actions,
.group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.entry-heading h3,
.entry-heading p { margin: 0; }
label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .82rem; }
.group-editor section { margin-top: .75rem; }
.group-row { margin: .35rem 0; }
.group-row input { min-width: 0; flex: 1; }
.field-error { color: #e88c8c; }
.warning { color: #d7b66d; }
.history { display: grid; gap: .35rem; margin-top: 1rem; }
.revision-item { text-align: left; }
@media (max-width: 720px) {
  .entry-editor { max-height: none; }
}
</style>
