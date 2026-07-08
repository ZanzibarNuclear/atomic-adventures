<script setup>
import PublicImagePicker from "../character-builder/PublicImagePicker.vue";

const props = defineProps({
  owner: { type: Object, required: true },
  title: { type: String, default: "Location views" },
});

function ensureViews() {
  props.owner.views ??= [];
  return props.owner.views;
}

function uniqueViewId() {
  const used = new Set((props.owner.views ?? []).map((view) => view.id));
  let id = "view";
  let suffix = 2;
  while (used.has(id)) id = `view-${suffix++}`;
  return id;
}

function addView() {
  ensureViews().push({
    id: uniqueViewId(),
    kind: "image",
    src: "",
    label: "",
    alt: "",
  });
}

function removeView(index) {
  props.owner.views?.splice(index, 1);
  if (props.owner.views?.length === 0) delete props.owner.views;
}

function moveView(index, delta) {
  const views = props.owner.views ?? [];
  const next = index + delta;
  if (next < 0 || next >= views.length) return;
  const [view] = views.splice(index, 1);
  views.splice(next, 0, view);
}
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

    <div
      v-for="(view, index) in owner.views ?? []"
      :key="`${view.id}:${index}`"
      class="view-card">
      <div class="section-heading">
        <h4>{{ view.label || view.id || `View ${index + 1}` }}</h4>
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
          <button type="button" class="sm danger-outline" @click="removeView(index)">Remove</button>
        </div>
      </div>

      <div class="field-grid">
        <label>ID<input v-model="view.id" placeholder="doorway" /></label>
        <label>Kind<input v-model="view.kind" placeholder="image" /></label>
      </div>
      <label>Label<input v-model="view.label" placeholder="Conference room doorway" /></label>
      <PublicImagePicker
        v-model="view.src"
        folder="views"
        placeholder="views/..."
        label="Image asset"
      />
      <label>Alt text<textarea v-model="view.alt" rows="2" /></label>
    </div>
  </section>
</template>

<style scoped>
.view-card {
  display: grid;
  gap: .55rem;
  padding: .65rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #171b22;
}
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.empty-note { margin: 0; color: #8e96a3; font-size: .82rem; }
</style>
