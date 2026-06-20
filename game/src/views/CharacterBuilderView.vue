<script setup>
import CharacterCatalogBrowser from "../components/character-builder/CharacterCatalogBrowser.vue";
import CharacterEntryEditor from "../components/character-builder/CharacterEntryEditor.vue";
import CharacterView from "../components/game-views/CharacterView.vue";
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
</script>

<template>
  <main v-if="draft" class="character-builder">
    <header class="builder-toolbar">
      <div>
        <p class="label">Content</p>
        <h2>Character and artifacts</h2>
      </div>
      <div class="toolbar-actions">
        <nav class="workspace-toggle" aria-label="Content builder workspace">
          <button
            type="button"
            :class="{ active: workspaceMode === 'character' }"
            @click="selectWorkspace('character')">
            Character
          </button>
          <button
            type="button"
            :class="{ active: workspaceMode === 'artifacts' }"
            @click="selectWorkspace('artifacts')">
            Artifacts
          </button>
          <button
            type="button"
            :class="{ active: workspaceMode === 'preview' }"
            @click="selectWorkspace('preview')">
            Preview
          </button>
        </nav>
        <span v-if="dirty" class="dirty-pill">Unsaved</span>
        <button class="sm muted" :disabled="!dirty" @click="revertDraft">Revert</button>
        <button class="sm muted" @click="loadHistory">History</button>
        <button class="sm" :disabled="!dirty" @click="saveDraft">Save content</button>
      </div>
    </header>

    <p v-if="status" class="status">{{ status }}</p>

    <div v-if="workspaceMode !== 'preview'" class="builder-grid edit-grid">
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
        @add-group="addGroup"
        @delete-entry="deleteEntry"
        @duplicate-entry="duplicateEntry"
        @move-entry="moveEntry"
        @remove-group="removeGroup"
        @rename-entry="renameEntry"
        @restore-revision="restoreRevision" />
    </div>

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
.character-builder { padding: .85rem; }
.builder-toolbar,
.toolbar-actions,
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.builder-toolbar h2,
.builder-toolbar p { margin: 0; }
.workspace-toggle {
  display: inline-flex;
  gap: .35rem;
  padding: .25rem;
  border: 1px solid #343d4d;
  border-radius: 999px;
  background: #161b22;
}
.workspace-toggle button {
  border-radius: 999px;
  border-color: transparent;
  background: transparent;
  color: #b8c0cc;
}
.workspace-toggle button.active {
  border-color: #6f9b79;
  background: #49624f;
  color: #eef7ef;
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
.panel { padding: .85rem; border: 1px solid #343d4d; border-radius: 10px; background: #1d222b; }
label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .82rem; }
.preview-workspace :deep(.character-view) { min-height: 0; }
.preview-workspace :deep(.character-view-header > button) { display: none; }
.status,
.dirty-pill { padding: .45rem .65rem; border-radius: 6px; background: #303b32; }
.unsaved-backdrop {
  position: fixed; inset: 0; z-index: 100; display: grid; place-items: center;
  padding: 1rem; background: rgba(7, 9, 12, .72);
}
.unsaved-dialog {
  max-width: 34rem; padding: 1.2rem; border: 1px solid #465166;
  border-radius: 10px; background: #202630;
}
@media (max-width: 1100px) {
  .builder-grid { grid-template-columns: minmax(15rem, .8fr) minmax(20rem, 1.2fr); }
}
@media (max-width: 720px) {
  .builder-grid { grid-template-columns: 1fr; }
}
</style>
