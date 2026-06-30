<script setup>
import CharacterCatalogBrowser from "../components/character-builder/CharacterCatalogBrowser.vue";
import CharacterEntryEditor from "../components/character-builder/CharacterEntryEditor.vue";
import CharacterOptionsEditor from "../components/character-builder/CharacterOptionsEditor.vue";
import CharacterView from "../components/game-views/CharacterView.vue";
import BuilderPageHeader from "../components/builder/BuilderPageHeader.vue";
import BuilderWorkspaceTabs from "../components/builder/BuilderWorkspaceTabs.vue";
import {
  useCharacterBuilderDraft,
  visibilityOptions,
} from "../composables/useCharacterBuilderDraft.js";

const {
  activeCatalogs,
  addEntry,
  addGroup,
  deleteEntry,
  dirty,
  discardAndLeave,
  draft,
  duplicateEntry,
  errorMessages,
  keepEditing,
  labelize,
  loadCharacter,
  loadHistory,
  moveEntry,
  navigationPromptVisible,
  previewCharacter,
  previewMode,
  removeGroup,
  renameEntry,
  restoreRevision,
  revertDraft,
  revisions,
  saveAndLeave,
  saveDraft,
  savingBeforeNavigation,
  selectCatalog,
  selectedCatalog,
  selectedEntry,
  selectedId,
  setCsv,
  setJson,
  setOptionalNumber,
  showHistory,
  status,
  toggleTab,
  warnings,
  workspaceMode,
  selectWorkspace,
} = useCharacterBuilderDraft();

const contentWorkspaceTabs = [
  { id: "character", label: "Character" },
  { id: "artifacts", label: "Artifacts" },
  { id: "options", label: "Options" },
  { id: "preview", label: "Preview" },
];
</script>

<template>
  <main v-if="draft" class="character-builder">
    <BuilderPageHeader title="Content Builder">
      <template #tabs>
        <BuilderWorkspaceTabs
          aria-label="Content builder workspace"
          :items="contentWorkspaceTabs"
          :active-id="workspaceMode"
          @select="selectWorkspace"
        />
      </template>
      <template #actions>
        <span v-if="dirty" class="dirty-pill">Unsaved</span>
        <button class="sm muted" :disabled="!dirty" @click="revertDraft">Revert</button>
        <button class="sm muted" @click="loadHistory">History</button>
        <button class="sm" :disabled="!dirty" @click="saveDraft">Save content</button>
      </template>
    </BuilderPageHeader>

    <p v-if="status" class="status">{{ status }}</p>

    <div v-if="workspaceMode === 'character' || workspaceMode === 'artifacts'" class="builder-grid edit-grid">
      <CharacterCatalogBrowser
        :draft="draft"
        :workspace-mode="workspaceMode"
        :active-catalogs="activeCatalogs"
        :selected-catalog="selectedCatalog"
        :selected-id="selectedId"
        :labelize="labelize"
        @add-entry="addEntry"
        @select-catalog="selectCatalog"
        @select-entry="selectedId = $event"
        @toggle-tab="toggleTab" />

      <CharacterEntryEditor
        :draft="draft"
        :selected-catalog="selectedCatalog"
        :selected-entry="selectedEntry"
        :error-messages="errorMessages"
        :warnings="warnings"
        :show-history="showHistory"
        :revisions="revisions"
        :visibility-options="visibilityOptions"
        :labelize="labelize"
        :set-csv="setCsv"
        :set-optional-number="setOptionalNumber"
        :set-json="setJson"
        @delete-entry="deleteEntry"
        @duplicate-entry="duplicateEntry"
        @move-entry="moveEntry"
        @rename-entry="renameEntry"
        @restore-revision="restoreRevision" />
    </div>

    <section v-else-if="workspaceMode === 'options'" class="options-workspace panel">
      <CharacterOptionsEditor
        :draft="draft"
        @add-group="addGroup"
        @remove-group="removeGroup" />
    </section>

    <section v-else class="preview-workspace panel">
      <div class="preview-toolbar">
        <div>
          <p class="label">Player-facing view</p>
          <h3>Panel preview</h3>
        </div>
        <label>
          Preview state
          <select v-model="previewMode">
            <option value="empty">Empty</option>
            <option value="early">Early game</option>
            <option value="populated">Populated</option>
          </select>
        </label>
      </div>
      <CharacterView :character="previewCharacter" />
    </section>

    <div v-if="navigationPromptVisible" class="unsaved-backdrop" role="dialog" aria-modal="true">
      <section class="unsaved-dialog">
        <p class="label">Unsaved content changes</p>
        <h2>Leave the Content Builder?</h2>
        <p>Save the draft, discard it, or keep editing.</p>
        <div class="toolbar-actions">
          <button :disabled="savingBeforeNavigation" @click="saveAndLeave">Save and continue</button>
          <button class="danger-outline" @click="discardAndLeave">Discard changes</button>
          <button class="muted" @click="keepEditing">Keep editing</button>
        </div>
      </section>
    </div>
  </main>
  <section v-else class="character-builder">
    <p class="status">{{ status || "Loading content…" }}</p>
    <button v-if="status" class="sm" @click="loadCharacter">Retry</button>
  </section>
</template>

<style scoped>
.character-builder {
  max-width: 1500px;
  margin: 0 auto;
  padding: .85rem 1rem;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.builder-grid {
  display: grid;
  grid-template-columns: minmax(15rem, .75fr) minmax(26rem, 1.35fr);
  gap: .75rem;
  margin-top: .75rem;
  align-items: start;
}
.preview-workspace {
  display: grid;
  gap: .75rem;
  max-width: 72rem;
  margin-top: .75rem;
}
.options-workspace {
  max-width: 48rem;
  margin-top: .75rem;
}
.panel { padding: .85rem; border: 1px solid #343d4d; border-radius: 10px; background: #20252f; }
label { display: grid; gap: .35rem; color: #bdc4ce; font-size: .8rem; }
select {
  width: 100%;
  min-width: 0;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: .5rem .6rem;
  font: inherit;
}
select:focus {
  outline: 2px solid #6ea57b;
  outline-offset: 1px;
  border-color: #6ea57b;
}
.preview-workspace :deep(.character-view) { min-height: 0; }
.preview-workspace :deep(.character-view-header > button) { display: none; }
.status,
.dirty-pill {
  width: fit-content;
  margin-top: .75rem;
  padding: .45rem .65rem;
  border: 1px solid #3e5b45;
  border-radius: 7px;
  background: #24372a;
  color: #bce8c7;
}
.dirty-pill {
  margin-top: 0;
}
.unsaved-backdrop {
  position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
  padding: 1rem; background: rgba(7, 9, 12, .72);
}
.unsaved-dialog {
  display: grid;
  gap: .75rem;
  max-width: 34rem;
  padding: 1rem;
  border: 1px solid #465166;
  border-radius: 10px;
  background: #20252f;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .45);
}
.unsaved-dialog h2,
.unsaved-dialog p { margin: 0; }
.toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .5rem;
  flex-wrap: wrap;
}
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
@media (max-width: 1100px) {
  .builder-grid { grid-template-columns: minmax(15rem, .8fr) minmax(20rem, 1.2fr); }
}
@media (max-width: 720px) {
  .builder-grid { grid-template-columns: 1fr; }
}
</style>
