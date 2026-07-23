<script setup>
import { computed, ref, watch } from "vue";
import PublicImagePicker from "../character-builder/PublicImagePicker.vue";
import {
  describeViewWhen,
  normalizeViewWhen,
  publicAssetPath,
} from "../../lib/maps/locationMedia.js";

const props = defineProps({
  owner: { type: Object, required: true },
  title: { type: String, default: "Location views" },
  /** Label used on the drill-out control, e.g. "Room" or "Hex". */
  parentLabel: { type: String, default: "details" },
});

const emit = defineEmits(["drill-change"]);

let nextEditorKey = 1;
const editorKeys = new WeakMap();
const editingIndex = ref(null);
const editingDraft = ref(null);

const drilledIn = computed(() => editingDraft.value !== null);
const editingTitle = computed(() => {
  if (!editingDraft.value) return "Location view";
  return editingIndex.value === null
    ? "New location view"
    : editingDraft.value.label || editingDraft.value.id || "Edit location view";
});

function ensureViews() {
  props.owner.views ??= [];
  return props.owner.views;
}

function editorKey(view) {
  if (!view || typeof view !== "object") return `view-${nextEditorKey++}`;
  if (!editorKeys.has(view)) editorKeys.set(view, `view-${nextEditorKey++}`);
  return editorKeys.get(view);
}

function uniqueViewId() {
  const used = new Set(
    (props.owner.views ?? [])
      .map((view, index) => (index === editingIndex.value ? null : view.id))
      .filter(Boolean),
  );
  let id = "view";
  let suffix = 2;
  while (used.has(id)) id = `view-${suffix++}`;
  return id;
}

function defaultWhenDraft() {
  return {
    stationPower: "",
    roomLights: "",
    allText: "",
    anyText: "",
    notText: "",
    passage: "",
    open: true,
  };
}

function whenToDraft(when) {
  const normalized = normalizeViewWhen(when) ?? {};
  return {
    stationPower: normalized.stationPower ?? "",
    roomLights: normalized.roomLights ?? "",
    allText: (normalized.all ?? []).join(", "),
    anyText: (normalized.any ?? []).join(", "),
    notText: (normalized.not ?? []).join(", "),
    passage: normalized.passage ?? "",
    open: typeof normalized.open === "boolean" ? normalized.open : true,
  };
}

function draftToWhen(draft) {
  return normalizeViewWhen({
    stationPower: draft.stationPower || null,
    roomLights: draft.roomLights || null,
    all: splitFlagList(draft.allText),
    any: splitFlagList(draft.anyText),
    not: splitFlagList(draft.notText),
    passage: draft.passage || null,
    open: draft.passage ? Boolean(draft.open) : null,
  });
}

function splitFlagList(text) {
  return String(text ?? "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function defaultViewDraft() {
  return {
    id: uniqueViewId(),
    kind: "image",
    src: "",
    label: "",
    alt: "",
    whenDraft: defaultWhenDraft(),
  };
}

function cloneView(view) {
  return {
    ...defaultViewDraft(),
    id: view?.id || uniqueViewId(),
    kind: view?.kind || "image",
    src: view?.src || "",
    label: view?.label || "",
    alt: view?.alt || "",
    whenDraft: whenToDraft(view?.when),
  };
}

function setDrilled(next) {
  emit("drill-change", Boolean(next));
}

function addView() {
  editingIndex.value = null;
  editingDraft.value = defaultViewDraft();
  setDrilled(true);
}

function openView(index) {
  const view = props.owner.views?.[index];
  if (!view) return;
  editingIndex.value = index;
  editingDraft.value = cloneView(view);
  setDrilled(true);
}

function cancelEdit() {
  editingIndex.value = null;
  editingDraft.value = null;
  setDrilled(false);
}

function applyEdit() {
  if (!editingDraft.value) return;
  const when = draftToWhen(editingDraft.value.whenDraft);
  const nextView = {
    id: editingDraft.value.id,
    kind: editingDraft.value.kind || "image",
    src: editingDraft.value.src,
    label: editingDraft.value.label,
    alt: editingDraft.value.alt,
    ...(when ? { when } : {}),
  };
  if (editingIndex.value === null) {
    ensureViews().push(nextView);
  } else if (props.owner.views?.[editingIndex.value]) {
    const current = props.owner.views[editingIndex.value];
    for (const key of Object.keys(current)) delete current[key];
    Object.assign(current, nextView);
  }
  cancelEdit();
}

function removeView(index) {
  props.owner.views?.splice(index, 1);
  if (props.owner.views?.length === 0) delete props.owner.views;
  if (editingIndex.value === index) cancelEdit();
  else if (editingIndex.value !== null && editingIndex.value > index) editingIndex.value -= 1;
}

function moveView(index, delta) {
  const views = props.owner.views ?? [];
  const next = index + delta;
  if (next < 0 || next >= views.length) return;
  const [view] = views.splice(index, 1);
  views.splice(next, 0, view);
  if (editingIndex.value === index) editingIndex.value = next;
  else if (editingIndex.value === next) editingIndex.value = index;
}

function conditionLabel(view) {
  return describeViewWhen(view?.when);
}

watch(
  () => props.owner,
  () => cancelEdit(),
);
</script>

<template>
  <!-- Drill-in: only the focused view fills the inspector -->
  <section v-if="drilledIn" class="location-views-drill form-section">
    <div class="drill-toolbar">
      <button type="button" class="sm muted back-btn" @click="cancelEdit">
        ← Back to {{ parentLabel }}
      </button>
    </div>
    <header class="editor-heading">
      <div>
        <p class="label">{{ title }}</p>
        <h3>{{ editingTitle }}</h3>
      </div>
    </header>

    <form class="view-editor-panel" @submit.prevent="applyEdit">
      <div class="field-grid">
        <label>ID<input v-model="editingDraft.id" placeholder="conference-room-dark" /></label>
        <label>Kind<input v-model="editingDraft.kind" placeholder="image" /></label>
      </div>
      <label>Label<input v-model="editingDraft.label" placeholder="Conference room (dark)" /></label>
      <PublicImagePicker
        v-model="editingDraft.src"
        folder="views"
        placeholder="views/..."
        label="Image asset"
      />
      <label>Alt text<textarea v-model="editingDraft.alt" rows="2" /></label>

      <fieldset class="when-fieldset">
        <legend>Show when</legend>
        <p class="help-note">
          Leave blank to always include this image. All filled conditions must match.
        </p>
        <label>
          Station power
          <select v-model="editingDraft.whenDraft.stationPower">
            <option value="">Any</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </label>
        <label>
          Room lights (power + switch)
          <select v-model="editingDraft.whenDraft.roomLights">
            <option value="">Any</option>
            <option value="on">On (powered and switch closed)</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label>
          Flags required (all)
          <input
            v-model="editingDraft.whenDraft.allText"
            placeholder="room.conference.lights-on, hub.example"
          />
        </label>
        <label>
          Flags any-of
          <input
            v-model="editingDraft.whenDraft.anyText"
            placeholder="optional, comma-separated"
          />
        </label>
        <label>
          Flags excluded (not)
          <input
            v-model="editingDraft.whenDraft.notText"
            placeholder="room.conference.lights-on"
          />
        </label>
        <div class="field-grid">
          <label>
            Passage id (outdoor)
            <input v-model="editingDraft.whenDraft.passage" placeholder="compound-gate" />
          </label>
          <label class="checkbox-label">
            Passage open
            <input v-model="editingDraft.whenDraft.open" type="checkbox" :disabled="!editingDraft.whenDraft.passage" />
          </label>
        </div>
        <p class="when-preview">Preview: {{ describeViewWhen(draftToWhen(editingDraft.whenDraft)) }}</p>
      </fieldset>

      <div class="editor-actions">
        <button type="button" class="sm muted" @click="cancelEdit">Cancel</button>
        <button type="submit" class="sm">Apply</button>
      </div>
    </form>
  </section>

  <!-- List mode: views as navigable sub-items of the parent entity -->
  <section v-else class="form-section location-views-panel">
    <div class="section-heading">
      <h4>{{ title }}</h4>
      <button type="button" class="sm" @click="addView">Add view</button>
    </div>

    <p class="help-note">
      Click a view to open it alone. Conditions control when the image is available in play.
    </p>

    <p v-if="!(owner.views ?? []).length" class="empty-note">
      No location images yet.
    </p>

    <ul v-if="(owner.views ?? []).length" class="view-list">
      <li
        v-for="(view, index) in owner.views ?? []"
        :key="editorKey(view)"
        class="view-row"
      >
        <button type="button" class="view-summary" @click="openView(index)">
          <span class="view-thumb">
            <img v-if="view.src" :src="publicAssetPath(view.src)" :alt="view.alt || view.label || view.id || 'Location view'">
            <span v-else>No image</span>
          </span>
          <span class="view-meta">
            <strong>{{ view.label || view.id || `View ${index + 1}` }}</strong>
            <span>{{ view.id || "No ID" }}</span>
            <span>{{ view.src || "No image asset" }}</span>
            <span class="when-line">{{ conditionLabel(view) }}</span>
          </span>
          <span class="drill-chevron" aria-hidden="true">›</span>
        </button>
        <div class="row-actions">
          <button type="button" class="sm muted" :disabled="index === 0" @click="moveView(index, -1)">Up</button>
          <button
            type="button"
            class="sm muted"
            :disabled="index === owner.views.length - 1"
            @click="moveView(index, 1)"
          >
            Down
          </button>
          <button type="button" class="sm muted" @click="openView(index)">Open</button>
          <button type="button" class="sm danger-outline" @click="removeView(index)">Remove</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.location-views-panel,
.location-views-drill {
  display: grid;
  gap: .65rem;
}
.help-note {
  margin: 0;
  color: #8e96a3;
  font-size: .78rem;
  line-height: 1.4;
}
.view-list {
  display: grid;
  gap: .5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.view-row {
  display: grid;
  gap: .55rem;
  padding: .55rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #171b22;
}
.view-summary {
  width: 100%;
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) 1.25rem;
  gap: .65rem;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.view-summary:hover .view-meta strong {
  color: #fff;
}
.view-thumb {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1672 / 941;
  border: 1px solid #303a4b;
  border-radius: 6px;
  background: #111820;
  color: #8e96a3;
  font-size: .7rem;
  overflow: hidden;
}
.view-thumb img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.view-meta {
  min-width: 0;
  display: grid;
  gap: .18rem;
}
.view-meta strong {
  color: #eef1f5;
  font-size: .82rem;
}
.view-meta span {
  color: #9da7b5;
  font-size: .72rem;
  overflow-wrap: anywhere;
}
.when-line {
  color: #b7c4a3 !important;
}
.drill-chevron {
  color: #8e96a3;
  font-size: 1.25rem;
  line-height: 1;
}
.drill-toolbar {
  display: flex;
  align-items: center;
}
.back-btn {
  justify-self: start;
}
.view-editor-panel {
  display: grid;
  gap: .7rem;
  padding: 0;
  border: 0;
  background: transparent;
}
.editor-heading,
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
}
.editor-heading h3,
.editor-heading p {
  margin: 0;
}
.editor-heading h3 {
  color: #eef1f5;
  font-size: 1rem;
}
.editor-actions {
  justify-content: flex-end;
}
.view-editor-panel label,
.when-fieldset label {
  display: grid;
  gap: .35rem;
  color: #bdc4ce;
  font-size: .8rem;
}
.view-editor-panel input,
.view-editor-panel textarea,
.view-editor-panel select,
.when-fieldset input,
.when-fieldset select {
  width: 100%;
  padding: .5rem;
  border: 1px solid #3a4558;
  border-radius: 6px;
  background: #10151d;
  color: #eef1f5;
  font: inherit;
}
.view-editor-panel textarea {
  resize: vertical;
}
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.when-fieldset {
  display: grid;
  gap: .55rem;
  margin: 0;
  padding: .65rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
}
.when-fieldset legend {
  padding: 0 .35rem;
  color: #d5dbe5;
  font-size: .8rem;
}
.checkbox-label {
  align-content: end;
}
.checkbox-label input {
  width: auto;
  justify-self: start;
}
.when-preview {
  margin: 0;
  color: #b7c4a3;
  font-size: .75rem;
}
.empty-note { margin: 0; color: #8e96a3; font-size: .82rem; }
@media (max-width: 720px) {
  .view-summary,
  .field-grid {
    grid-template-columns: 1fr;
  }
  .drill-chevron { display: none; }
}
</style>
