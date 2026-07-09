<script setup>
import { computed, ref, watch } from "vue";
import PublicImagePicker from "../character-builder/PublicImagePicker.vue";
import { publicAssetPath } from "../../lib/maps/locationMedia.js";

const props = defineProps({
  owner: { type: Object, required: true },
  title: { type: String, default: "Location views" },
});

let nextEditorKey = 1;
const editorKeys = new WeakMap();
const editingIndex = ref(null);
const editingDraft = ref(null);

const editing = computed(() => editingDraft.value !== null);
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

function defaultViewDraft() {
  return {
    id: uniqueViewId(),
    kind: "image",
    src: "",
    label: "",
    alt: "",
  };
}

function cloneView(view) {
  return {
    ...defaultViewDraft(),
    ...(view ?? {}),
  };
}

function addView() {
  editingIndex.value = null;
  editingDraft.value = defaultViewDraft();
}

function editView(index) {
  const view = props.owner.views?.[index];
  if (!view) return;
  editingIndex.value = index;
  editingDraft.value = cloneView(view);
}

function cancelEdit() {
  editingIndex.value = null;
  editingDraft.value = null;
}

function applyEdit() {
  if (!editingDraft.value) return;
  const nextView = { ...editingDraft.value };
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

watch(
  () => props.owner,
  () => cancelEdit(),
);
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>{{ title }}</h4>
      <button type="button" class="sm" @click="addView">Add view</button>
    </div>

    <p v-if="!(owner.views ?? []).length" class="empty-note">
      No location images yet.
    </p>

    <ul v-if="(owner.views ?? []).length" class="view-list">
      <li
        v-for="(view, index) in owner.views ?? []"
        :key="editorKey(view)"
        class="view-row"
        :class="{ active: editingIndex === index }">
        <button type="button" class="view-summary" @click="editView(index)">
          <span class="view-thumb">
            <img v-if="view.src" :src="publicAssetPath(view.src)" :alt="view.alt || view.label || view.id || 'Location view'">
            <span v-else>No image</span>
          </span>
          <span class="view-meta">
            <strong>{{ view.label || view.id || `View ${index + 1}` }}</strong>
            <span>{{ view.id || "No ID" }}</span>
            <span>{{ view.src || "No image asset" }}</span>
          </span>
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
          <button type="button" class="sm muted" @click="editView(index)">Edit</button>
          <button type="button" class="sm danger-outline" @click="removeView(index)">Remove</button>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="editing"
        class="view-editor-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="editingTitle"
        @click.self="cancelEdit">
        <form class="view-editor-dialog" @submit.prevent="applyEdit">
          <header class="editor-heading">
            <div>
              <p class="label">{{ title }}</p>
              <h3>{{ editingTitle }}</h3>
            </div>
            <button
              type="button"
              class="icon-btn close-btn"
              aria-label="Cancel editing"
              @click="cancelEdit">
              ×
            </button>
          </header>

          <div class="field-grid">
            <label>ID<input v-model="editingDraft.id" placeholder="doorway" /></label>
            <label>Kind<input v-model="editingDraft.kind" placeholder="image" /></label>
          </div>
          <label>Label<input v-model="editingDraft.label" placeholder="Conference room doorway" /></label>
          <PublicImagePicker
            v-model="editingDraft.src"
            folder="views"
            placeholder="views/..."
            label="Image asset"
          />
          <label>Alt text<textarea v-model="editingDraft.alt" rows="3" /></label>

          <div class="editor-actions">
            <button type="button" class="sm muted" @click="cancelEdit">Cancel</button>
            <button type="submit" class="sm">Apply</button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
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
.view-row.active {
  border-color: #7186aa;
  background: #1d2532;
}
.view-summary {
  width: 100%;
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: .65rem;
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
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
.view-editor-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(5, 8, 13, 0.72);
}
.view-editor-dialog {
  width: min(44rem, 100%);
  max-height: min(90vh, 52rem);
  overflow: auto;
  display: grid;
  gap: .75rem;
  padding: .9rem;
  border: 1px solid #3f4b60;
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, .45);
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
.close-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid #3a4558;
  background: #222a36;
  color: #eef1f5;
  cursor: pointer;
}
.view-editor-dialog label {
  display: grid;
  gap: .35rem;
  color: #bdc4ce;
  font-size: .8rem;
}
.view-editor-dialog input,
.view-editor-dialog textarea {
  width: 100%;
  padding: .5rem;
  border: 1px solid #3a4558;
  border-radius: 6px;
  background: #10151d;
  color: #eef1f5;
  font: inherit;
}
.view-editor-dialog textarea {
  resize: vertical;
}
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.empty-note { margin: 0; color: #8e96a3; font-size: .82rem; }
@media (max-width: 720px) {
  .view-summary,
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
