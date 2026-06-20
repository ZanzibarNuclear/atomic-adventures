<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import CharacterView from "../components/game-views/CharacterView.vue";
import { storyApi } from "../lib/storyApi.js";

const router = useRouter();
const draft = ref(null);
const baseline = ref("");
const version = ref(0);
const status = ref("");
const errors = ref({});
const warnings = ref([]);
const selectedCatalog = ref("items");
const selectedId = ref("");
const workspaceMode = ref("edit");
const previewMode = ref("early");
const revisions = ref([]);
const showHistory = ref(false);
const pendingRoute = ref("");
const navigationPromptVisible = ref(false);
const savingBeforeNavigation = ref(false);

const catalogs = [
  { id: "items", label: "Items" },
  { id: "stats", label: "Stats" },
  { id: "knowledge", label: "Knowledge" },
  { id: "skills", label: "Skills" },
  { id: "quests", label: "Quests" },
  { id: "documents", label: "Documents" },
];
const tabOptions = ["overview", "inventory", "knowledge", "skills", "quests", "documents"];
const visibilityOptions = ["always", "when-acquired", "when-started", "hidden"];

const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value);
const selectedEntry = computed(() =>
  (draft.value?.[selectedCatalog.value] ?? []).find((entry) => entry.id === selectedId.value) ?? null,
);
const errorMessages = computed(() =>
  Object.entries(errors.value).flatMap(([path, messages]) =>
    messages.map((message) => `${path}: ${message}`),
  ),
);
const previewCharacter = computed(() => {
  const definitions = draft.value ?? {
    profile: {},
    panel: {},
    items: [],
    stats: [],
    knowledge: [],
    skills: [],
    quests: [],
    documents: [],
  };
  const populated = previewMode.value === "populated";
  const early = previewMode.value === "early";
  const include = (index) => populated || (early && index === 0);
  return {
    definitions,
    holdings: {
      items: Object.fromEntries(
        definitions.items.map((item, index) => include(index)
          ? [item.id, { quantity: item.carrying === "stack" ? 3 : 1 }]
          : null).filter(Boolean),
      ),
    },
    stats: Object.fromEntries(definitions.stats.map((stat) => [stat.id, stat.default ?? 0])),
    knowledge: Object.fromEntries(
      definitions.knowledge.map((entry, index) => include(index)
        ? [entry.id, { acquiredAt: "preview" }]
        : null).filter(Boolean),
    ),
    skills: Object.fromEntries(
      definitions.skills.map((entry, index) => include(index)
        ? [entry.id, { rank: 1, evidence: {}, acquiredAt: "preview" }]
        : null).filter(Boolean),
    ),
    quests: Object.fromEntries(
      definitions.quests.map((entry, index) => include(index)
        ? [entry.id, { status: index === 0 ? "active" : "available", objectives: {} }]
        : null).filter(Boolean),
    ),
    documents: Object.fromEntries(
      definitions.documents.map((entry, index) => include(index)
        ? [entry.id, { discoveredAt: "preview" }]
        : null).filter(Boolean),
    ),
  };
});

onMounted(async () => {
  window.addEventListener("beforeunload", warnBeforeUnload);
  await loadCharacter();
});
onBeforeUnmount(() => window.removeEventListener("beforeunload", warnBeforeUnload));
onBeforeRouteLeave((to) => {
  if (!dirty.value) return true;
  pendingRoute.value = to.fullPath;
  navigationPromptVisible.value = true;
  return false;
});

async function loadCharacter() {
  try {
    const result = await storyApi("/api/character");
    applyLoaded(result);
  } catch (error) {
    status.value = error.message;
  }
}

function applyLoaded(result) {
  draft.value = structuredClone(result.character);
  version.value = result.version;
  baseline.value = JSON.stringify(draft.value);
  warnings.value = result.warnings ?? [];
  errors.value = {};
  status.value = "";
  ensureSelection();
}

function ensureSelection() {
  const entries = draft.value?.[selectedCatalog.value] ?? [];
  if (!entries.some((entry) => entry.id === selectedId.value)) {
    selectedId.value = entries[0]?.id ?? "";
  }
}

function selectCatalog(id) {
  selectedCatalog.value = id;
  selectedId.value = draft.value?.[id]?.[0]?.id ?? "";
}

function toggleTab(tab) {
  const tabs = draft.value.panel.tabs;
  draft.value.panel.tabs = tabs.includes(tab)
    ? tabs.filter((item) => item !== tab)
    : [...tabs, tab];
}

function addGroup(kind) {
  const groups = draft.value.panel[kind];
  const id = uniqueId(kind === "statGroups" ? "status" : "group", groups);
  groups.push({ id, label: labelize(id), order: groups.length * 10 + 10 });
}

function removeGroup(kind, id) {
  draft.value.panel[kind] = draft.value.panel[kind].filter((group) => group.id !== id);
}

function addEntry() {
  const entries = draft.value[selectedCatalog.value];
  const id = uniqueId(`new-${selectedCatalog.value.replace(/s$/, "")}`, entries);
  const defaults = {
    items: {
      id, label: labelize(id), description: null, kind: "item", group: null,
      icon: null, tags: [], carrying: "unique", maxQuantity: 1, portable: true,
      visible: "when-acquired", relatedDocument: null,
    },
    stats: {
      id, label: labelize(id), type: "integer", group: null, order: entries.length,
      visible: "always", default: 0,
    },
    knowledge: {
      id, label: labelize(id), description: null, order: entries.length,
      visible: "when-acquired",
    },
    skills: {
      id, label: labelize(id), description: null, mode: "acquired", maxRank: 1,
      rankLabels: [], practice: { evidence: [], awards: [] },
      order: entries.length, visible: "when-acquired",
    },
    quests: {
      id, label: labelize(id), description: null, order: entries.length,
      visible: "when-started", autoComplete: false, objectives: [],
    },
    documents: {
      id, title: labelize(id), description: null, order: entries.length,
      visible: "when-acquired",
    },
  };
  entries.push(defaults[selectedCatalog.value]);
  selectedId.value = id;
}

function duplicateEntry() {
  if (!selectedEntry.value) return;
  const entries = draft.value[selectedCatalog.value];
  const copy = structuredClone(selectedEntry.value);
  copy.id = uniqueId(`${copy.id}-copy`, entries);
  if (copy.label) copy.label += " copy";
  if (copy.title) copy.title += " copy";
  entries.push(copy);
  selectedId.value = copy.id;
}

function moveEntry(delta) {
  const entries = draft.value[selectedCatalog.value];
  const index = entries.findIndex((entry) => entry.id === selectedId.value);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= entries.length) return;
  const [entry] = entries.splice(index, 1);
  entries.splice(next, 0, entry);
  entries.forEach((item, order) => { item.order = order; });
}

async function renameEntry() {
  const entry = selectedEntry.value;
  if (!entry) return;
  const next = window.prompt("New stable ID", entry.id)?.trim();
  if (!next || next === entry.id) return;
  const references = await loadReferences(selectedCatalog.value, entry.id);
  if (references.length) {
    status.value = `Cannot rename ${entry.id}; it has ${references.length} authored reference(s).`;
    return;
  }
  entry.id = next;
  selectedId.value = next;
}

async function deleteEntry() {
  const entry = selectedEntry.value;
  if (!entry) return;
  const references = await loadReferences(selectedCatalog.value, entry.id);
  if (references.length) {
    status.value = `Cannot delete ${entry.id}; referenced by ${references
      .map((reference) => reference.path).join(", ")}.`;
    return;
  }
  if (!window.confirm(`Delete "${entry.label ?? entry.title ?? entry.id}"?`)) return;
  draft.value[selectedCatalog.value] = draft.value[selectedCatalog.value]
    .filter((item) => item.id !== entry.id);
  ensureSelection();
}

async function loadReferences(domain, id) {
  return storyApi(
    `/api/character/references?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`,
  );
}

async function saveDraft() {
  errors.value = {};
  status.value = "Saving…";
  try {
    const result = await storyApi("/api/character", {
      method: "PUT",
      body: JSON.stringify({
        character: draft.value,
        expectedVersion: version.value,
      }),
    });
    applyLoaded(result);
    status.value = `Saved character version ${result.version}.`;
    return true;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.status === 409
      ? "Character content changed elsewhere. Reload before saving."
      : error.message;
    return false;
  }
}

function revertDraft() {
  draft.value = JSON.parse(baseline.value);
  errors.value = {};
  status.value = "";
  ensureSelection();
}

async function loadHistory() {
  revisions.value = await storyApi("/api/character/revisions");
  showHistory.value = true;
}

async function restoreRevision(revision) {
  if (!window.confirm(`Restore character revision ${revision}?`)) return;
  const result = await storyApi(`/api/character/revisions/${revision}/restore`, {
    method: "POST",
  });
  applyLoaded(result);
  await loadHistory();
}

function setCsv(target, key, event) {
  target[key] = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
}

function setOptionalNumber(target, key, event) {
  target[key] = event.target.value === "" ? undefined : Number(event.target.value);
}

function setJson(target, key, event, fallback) {
  try {
    target[key] = JSON.parse(event.target.value || JSON.stringify(fallback));
    status.value = "";
  } catch (error) {
    status.value = `Invalid JSON for ${key}: ${error.message}`;
  }
}

function uniqueId(base, entries) {
  const used = new Set(entries.map((entry) => entry.id));
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function labelize(id) {
  return id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function warnBeforeUnload(event) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
}

function keepEditing() {
  pendingRoute.value = "";
  navigationPromptVisible.value = false;
}

function discardAndLeave() {
  const route = pendingRoute.value;
  baseline.value = JSON.stringify(draft.value);
  keepEditing();
  void router.push(route);
}

async function saveAndLeave() {
  savingBeforeNavigation.value = true;
  const route = pendingRoute.value;
  const saved = await saveDraft();
  savingBeforeNavigation.value = false;
  if (!saved) return;
  keepEditing();
  void router.push(route);
}
</script>

<template>
  <main v-if="draft" class="character-builder">
    <header class="builder-toolbar">
      <div>
        <p class="label">Character content</p>
        <h2>{{ draft.profile.name }}</h2>
      </div>
      <div class="toolbar-actions">
        <nav class="workspace-toggle" aria-label="Character builder workspace">
          <button
            type="button"
            :class="{ active: workspaceMode === 'edit' }"
            @click="workspaceMode = 'edit'">
            Edit content
          </button>
          <button
            type="button"
            :class="{ active: workspaceMode === 'preview' }"
            @click="workspaceMode = 'preview'">
            Preview panel
          </button>
        </nav>
        <span v-if="dirty" class="dirty-pill">Unsaved</span>
        <button class="sm muted" :disabled="!dirty" @click="revertDraft">Revert</button>
        <button class="sm muted" @click="loadHistory">History</button>
        <button class="sm" :disabled="!dirty" @click="saveDraft">Save character</button>
      </div>
    </header>

    <p v-if="status" class="status">{{ status }}</p>

    <div v-if="workspaceMode === 'edit'" class="builder-grid edit-grid">
      <aside class="catalog-browser panel">
        <section class="profile-summary">
          <h3>Profile and panel</h3>
          <label>Name<input v-model="draft.profile.name"></label>
          <label>
            Portrait asset
            <input v-model="draft.profile.portrait" placeholder="characters/zanzibar/default.webp">
            <small>Place files in game/public; paths resolve from the public root.</small>
          </label>
          <label>Summary<textarea v-model="draft.profile.summary" rows="3"></textarea></label>
          <fieldset>
            <legend>Visible tabs</legend>
            <label v-for="tab in tabOptions" :key="tab" class="check-field">
              <input
                type="checkbox"
                :checked="draft.panel.tabs.includes(tab)"
                @change="toggleTab(tab)">
              {{ labelize(tab) }}
            </label>
          </fieldset>
        </section>

        <nav class="catalog-tabs" aria-label="Character catalog">
          <button
            v-for="catalog in catalogs"
            :key="catalog.id"
            :class="{ active: selectedCatalog === catalog.id }"
            @click="selectCatalog(catalog.id)">
            {{ catalog.label }} <span>{{ draft[catalog.id].length }}</span>
          </button>
        </nav>
        <button class="sm add-entry" @click="addEntry">+ Add {{ selectedCatalog.replace(/s$/, "") }}</button>
        <button
          v-for="entry in draft[selectedCatalog]"
          :key="entry.id"
          class="catalog-entry"
          :class="{ active: selectedId === entry.id }"
          @click="selectedId = entry.id">
          <strong>{{ entry.label ?? entry.title ?? entry.id }}</strong>
          <span>{{ entry.id }}</span>
        </button>
      </aside>

      <section class="entry-editor panel">
        <template v-if="selectedEntry">
          <div class="entry-heading">
            <div>
              <p class="label">{{ selectedCatalog }}</p>
              <h3>{{ selectedEntry.id }}</h3>
            </div>
            <div class="toolbar-actions">
              <button class="sm muted" @click="moveEntry(-1)">↑</button>
              <button class="sm muted" @click="moveEntry(1)">↓</button>
              <button class="sm muted" @click="renameEntry">Rename</button>
              <button class="sm muted" @click="duplicateEntry">Duplicate</button>
              <button class="sm danger-outline" @click="deleteEntry">Delete</button>
            </div>
          </div>

          <label v-if="selectedCatalog !== 'documents'">Label<input v-model="selectedEntry.label"></label>
          <label v-else>Title<input v-model="selectedEntry.title"></label>
          <label v-if="'description' in selectedEntry">
            Description<textarea v-model="selectedEntry.description" rows="4"></textarea>
          </label>

          <template v-if="selectedCatalog === 'items'">
            <div class="field-grid">
              <label>Kind<input v-model="selectedEntry.kind"></label>
              <label>Group
                <select v-model="selectedEntry.group">
                  <option :value="null">No group</option>
                  <option
                    v-for="group in draft.panel.inventoryGroups"
                    :key="group.id"
                    :value="group.id">{{ group.label }}</option>
                </select>
              </label>
              <label>Carrying
                <select v-model="selectedEntry.carrying">
                  <option value="unique">Unique</option>
                  <option value="stack">Stack</option>
                </select>
              </label>
              <label>Maximum quantity
                <input v-model.number="selectedEntry.maxQuantity" type="number" min="1">
              </label>
              <label>Icon asset<input v-model="selectedEntry.icon"></label>
              <label>Related document
                <select v-model="selectedEntry.relatedDocument">
                  <option :value="null">None</option>
                  <option v-for="document in draft.documents" :key="document.id" :value="document.id">
                    {{ document.title }}
                  </option>
                </select>
              </label>
            </div>
            <label>Tags
              <input :value="selectedEntry.tags.join(', ')" @input="setCsv(selectedEntry, 'tags', $event)">
            </label>
            <label class="check-field"><input v-model="selectedEntry.portable" type="checkbox"> Portable</label>
            <label>Properties (JSON)
              <textarea
                :value="JSON.stringify(selectedEntry.properties ?? {}, null, 2)"
                rows="6"
                @change="setJson(selectedEntry, 'properties', $event, {})"></textarea>
            </label>
            <label>Item actions (JSON)
              <textarea
                :value="JSON.stringify(selectedEntry.actions ?? [], null, 2)"
                rows="12"
                @change="setJson(selectedEntry, 'actions', $event, [])"></textarea>
            </label>
          </template>

          <template v-else-if="selectedCatalog === 'stats'">
            <div class="field-grid">
              <label>Type
                <select v-model="selectedEntry.type">
                  <option>integer</option><option>decimal</option><option>meter</option>
                  <option>boolean</option><option>enum</option>
                </select>
              </label>
              <label>Group
                <select v-model="selectedEntry.group">
                  <option :value="null">No group</option>
                  <option v-for="group in draft.panel.statGroups" :key="group.id" :value="group.id">
                    {{ group.label }}
                  </option>
                </select>
              </label>
              <label>Default<input v-model.number="selectedEntry.default" type="number"></label>
              <label>Minimum
                <input :value="selectedEntry.min" type="number" @input="setOptionalNumber(selectedEntry, 'min', $event)">
              </label>
              <label>Maximum
                <input :value="selectedEntry.max" type="number" @input="setOptionalNumber(selectedEntry, 'max', $event)">
              </label>
            </div>
            <label>Drift rates (JSON)
              <textarea
                :value="JSON.stringify(selectedEntry.drift ?? {}, null, 2)"
                rows="7"
                @change="setJson(selectedEntry, 'drift', $event, {})"></textarea>
            </label>
            <label>Thresholds (JSON)
              <textarea
                :value="JSON.stringify(selectedEntry.thresholds ?? [], null, 2)"
                rows="9"
                @change="setJson(selectedEntry, 'thresholds', $event, [])"></textarea>
            </label>
          </template>

          <template v-else-if="selectedCatalog === 'skills'">
            <div class="field-grid">
              <label>Mode
                <select v-model="selectedEntry.mode">
                  <option value="acquired">Acquired</option>
                  <option value="ranked">Ranked</option>
                </select>
              </label>
              <label>Maximum rank<input v-model.number="selectedEntry.maxRank" type="number" min="1"></label>
            </div>
            <label>Rank labels
              <input
                :value="(selectedEntry.rankLabels ?? []).join(', ')"
                @input="setCsv(selectedEntry, 'rankLabels', $event)">
            </label>
            <label>Practice and award rules (JSON)
              <textarea
                :value="JSON.stringify(selectedEntry.practice ?? { evidence: [], awards: [] }, null, 2)"
                rows="16"
                @change="setJson(selectedEntry, 'practice', $event, { evidence: [], awards: [] })"></textarea>
            </label>
          </template>

          <template v-if="selectedCatalog === 'quests'">
            <label class="check-field">
              <input v-model="selectedEntry.autoComplete" type="checkbox">
              Complete quest when every objective is complete
            </label>
            <label>Objectives (JSON)
              <textarea
                :value="JSON.stringify(selectedEntry.objectives, null, 2)"
                rows="10"
                @change="setJson(selectedEntry, 'objectives', $event, [])"></textarea>
            </label>
          </template>

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
              <button class="sm muted" @click="removeGroup('statGroups', group.id)">Remove</button>
            </div>
            <button class="sm" @click="addGroup('statGroups')">Add stat group</button>
          </section>
          <section>
            <h4>Inventory groups</h4>
            <div v-for="group in draft.panel.inventoryGroups" :key="group.id" class="group-row">
              <input v-model="group.id"><input v-model="group.label">
              <button class="sm muted" @click="removeGroup('inventoryGroups', group.id)">Remove</button>
            </div>
            <button class="sm" @click="addGroup('inventoryGroups')">Add inventory group</button>
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
            @click="restoreRevision(revision.revision)">
            r{{ revision.revision }} · {{ revision.operation }} ·
            {{ new Date(revision.createdAt).toLocaleString() }}
          </button>
        </section>
      </section>
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
        <p class="label">Unsaved character changes</p>
        <h2>Leave the Character Builder?</h2>
        <p>Save the draft, discard it, or keep editing.</p>
        <div class="toolbar-actions">
          <button :disabled="savingBeforeNavigation" @click="saveAndLeave">Save and continue</button>
          <button class="danger-outline" @click="discardAndLeave">Discard changes</button>
          <button class="muted" @click="keepEditing">Keep editing</button>
        </div>
      </section>
    </div>
  </main>
  <p v-else class="status">Loading character content…</p>
</template>

<style scoped>
.character-builder { padding: .85rem; }
.builder-toolbar,
.toolbar-actions,
.entry-heading,
.preview-toolbar,
.group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
.builder-toolbar h2,
.builder-toolbar p,
.entry-heading h3,
.entry-heading p { margin: 0; }
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
.catalog-browser,
.entry-editor { max-height: calc(100vh - 10.7rem); overflow: auto; }
.profile-summary { display: grid; gap: .55rem; }
.catalog-tabs { display: grid; grid-template-columns: repeat(2, 1fr); gap: .35rem; margin-top: .8rem; }
.catalog-tabs button,
.catalog-entry {
  display: flex;
  justify-content: space-between;
  gap: .5rem;
  text-align: left;
}
.catalog-tabs button.active,
.catalog-entry.active { border-color: #6f9b79; background: #49624f; }
.add-entry { width: 100%; margin: .6rem 0; }
.catalog-entry { width: 100%; margin-top: .3rem; }
.catalog-entry span { color: #8f98a6; font-size: .78rem; }
.entry-editor { display: grid; gap: .75rem; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; }
label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .82rem; }
.check-field { display: flex; align-items: center; }
.group-editor section { margin-top: .75rem; }
.group-row { margin: .35rem 0; }
.group-row input { min-width: 0; flex: 1; }
.preview-workspace :deep(.character-view) { min-height: 0; }
.preview-workspace :deep(.character-view-header > button) { display: none; }
.status,
.dirty-pill { padding: .45rem .65rem; border-radius: 6px; background: #303b32; }
.field-error { color: #e88c8c; }
.warning { color: #d7b66d; }
.history { display: grid; gap: .35rem; margin-top: 1rem; }
.revision-item { text-align: left; }
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
  .catalog-browser, .entry-editor { max-height: none; }
  .field-grid { grid-template-columns: 1fr; }
}
</style>
