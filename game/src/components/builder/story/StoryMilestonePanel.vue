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
      <button type="button" class="sm add-btn" @click="$emit('new')">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
        New milestone
      </button>
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
            <button type="button" class="sm muted" @click="cancelEdit">Cancel</button>
            <button type="submit" class="sm success-btn">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 4h11l3 3v13H5V4z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round" />
                <path
                  d="M8 4v5h8V4M8 20v-7h8v7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round" />
              </svg>
              Save
            </button>
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
            <button type="button" class="sm edit-btn" @click="startEdit(milestone, index)">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
                <path d="M12.5 6.5 17.5 11.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              </svg>
              Edit
            </button>
            <button type="button" class="sm danger" @click="$emit('remove', index)">
              <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round" />
              </svg>
              Remove
            </button>
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
