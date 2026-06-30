<script setup>
import { reactive, ref } from "vue";

defineProps({
  milestones: { type: Array, default: () => [] },
  status: { type: String, default: "" },
});

const emit = defineEmits(["new", "update", "remove"]);

const editingIndex = ref(null);
const draft = reactive({
  id: "",
  label: "",
  kind: "story",
  description: "",
});

const kindOptions = [
  "story",
  "discovery",
  "knowledge",
  "application",
  "operations",
  "survival",
  "world",
];

function startEdit(milestone, index) {
  editingIndex.value = index;
  draft.id = milestone.id ?? "";
  draft.label = milestone.label ?? "";
  draft.kind = milestone.kind ?? "story";
  draft.description = milestone.description ?? "";
}

function cancelEdit() {
  editingIndex.value = null;
}

function saveEdit(index) {
  emit("update", {
    index,
    milestone: {
      id: draft.id,
      label: draft.label,
      kind: draft.kind,
      description: draft.description,
    },
  });
  editingIndex.value = null;
}
</script>

<template>
  <section class="milestone-panel panel">
    <div class="section-heading">
      <div>
        <p class="label">Story state</p>
        <h2>Milestones</h2>
      </div>
      <button type="button" class="sm" @click="$emit('new')">New milestone</button>
    </div>

    <p v-if="status" class="builder-status">{{ status }}</p>

    <div v-if="milestones.length" class="milestone-list">
      <article
        v-for="(milestone, index) in milestones"
        :key="milestone.id || index"
        class="milestone-card"
      >
        <form
          v-if="editingIndex === index"
          class="milestone-edit"
          @submit.prevent="saveEdit(index)"
        >
          <label>Name
            <input v-model="draft.label">
          </label>
          <label>ID
            <input v-model="draft.id">
          </label>
          <label>Kind
            <select v-model="draft.kind">
              <option v-for="kind in kindOptions" :key="kind" :value="kind">{{ kind }}</option>
            </select>
          </label>
          <label>Description
            <textarea v-model="draft.description" rows="5"></textarea>
          </label>
          <div class="card-actions">
            <button type="button" class="card-button secondary" @click="cancelEdit">Cancel</button>
            <button type="submit" class="card-button save">Save</button>
          </div>
        </form>

        <div v-else class="milestone-readonly">
          <div class="milestone-card-header">
            <div>
              <h3>{{ milestone.label || milestone.id }}</h3>
              <p>{{ milestone.id }}</p>
            </div>
            <span class="kind-pill">{{ milestone.kind }}</span>
          </div>
          <p v-if="milestone.description" class="description">{{ milestone.description }}</p>
          <p v-else class="description empty">No description.</p>
          <div class="card-actions">
            <button type="button" class="card-button edit" @click="startEdit(milestone, index)">Edit</button>
            <button type="button" class="card-button danger" @click="$emit('remove', index)">Remove</button>
          </div>
        </div>
      </article>
    </div>

    <p v-else class="empty-note">No authored milestones yet.</p>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid #343d4d;
  border-radius: 10px;
  background: #20252f;
  padding: 0.85rem;
}

.milestone-panel {
  max-height: 100%;
  overflow: auto;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.label {
  color: #8e96a3;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.milestone-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  align-items: start;
}

.milestone-card {
  min-width: 0;
  border: 1px solid #506177;
  border-radius: 8px;
  background: #252d39;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .04) inset;
}

.milestone-readonly,
.milestone-edit {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  align-content: start;
}

.milestone-edit label {
  display: grid;
  gap: 0.45rem;
  color: #c6ccd5;
  font-size: 0.82rem;
  font-weight: 700;
}

.milestone-edit input,
.milestone-edit select,
.milestone-edit textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #121821;
  color: #eef1f5;
  padding: 0.6rem 0.65rem;
  font: inherit;
}

.milestone-edit input:focus,
.milestone-edit select:focus,
.milestone-edit textarea:focus {
  outline: 2px solid #6ea57b;
  outline-offset: 1px;
  border-color: #6ea57b;
}

.milestone-edit textarea {
  min-height: 8.5rem;
  resize: vertical;
  line-height: 1.45;
}

.milestone-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
  align-items: start;
}

.milestone-card-header h3 {
  margin: 0;
  color: #eef1f5;
  font-size: 1rem;
  line-height: 1.25;
}

.milestone-card-header p,
.description {
  margin: 0.25rem 0 0;
  color: #aeb5c0;
  font-size: 0.84rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.description {
  margin: 0;
  min-height: 3.65rem;
}

.description.empty {
  color: #7f8896;
  font-style: italic;
}

.kind-pill {
  border: 1px solid #4f5b70;
  border-radius: 999px;
  padding: 0.16rem 0.5rem;
  color: #d6dde8;
  background: #1a202a;
  font-size: 0.72rem;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-top: 0.15rem;
}

.card-button {
  border: 1px solid #536176;
  border-radius: 7px;
  padding: 0.45rem 0.75rem;
  color: #eef1f5;
  background: #334052;
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
}

.card-button:hover {
  filter: brightness(1.08);
}

.card-button.edit {
  border-color: #6c7f99;
  background: #405069;
  color: #f3f7fb;
}

.card-button.secondary {
  border-color: #6a7380;
  background: #3d4652;
  color: #f0f3f6;
}

.card-button.save {
  border-color: #6ea57b;
  background: #2f6f45;
  color: #f0fff3;
}

.card-button.danger {
  border-color: #b55c46;
  background: #8a3d2f;
  color: #fff2ed;
}

.empty-note,
.builder-status {
  color: #aeb5c0;
  font-size: 0.9rem;
}

@media (max-width: 820px) {
  .milestone-list {
    grid-template-columns: 1fr;
  }
}
</style>
