<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  flagIds: { type: Array, default: () => [] },
  label: { type: String, default: "Flags" },
  placeholder: { type: String, default: "flag.id" },
});

const emit = defineEmits(["update:modelValue"]);

const pickValue = ref("");
const writeIn = ref("");

const selected = computed(() =>
  (props.modelValue ?? []).map((id) => String(id).trim()).filter(Boolean),
);

const availableOptions = computed(() => {
  const taken = new Set(selected.value);
  return (props.flagIds ?? [])
    .map((id) => String(id).trim())
    .filter((id) => id && !taken.has(id))
    .sort((a, b) => a.localeCompare(b));
});

function emitList(next) {
  emit("update:modelValue", next);
}

function addFlag(raw) {
  const id = String(raw ?? "").trim();
  if (!id) return;
  if (selected.value.includes(id)) {
    pickValue.value = "";
    writeIn.value = "";
    return;
  }
  emitList([...selected.value, id]);
  pickValue.value = "";
  writeIn.value = "";
}

function removeFlag(id) {
  emitList(selected.value.filter((entry) => entry !== id));
}

function addFromPicker() {
  addFlag(pickValue.value);
}

function addFromWriteIn() {
  addFlag(writeIn.value);
}
</script>

<template>
  <div class="flag-list-editor">
    <span v-if="label" class="field-label">{{ label }}</span>

    <div v-if="selected.length" class="flag-chip-list">
      <span v-for="id in selected" :key="id" class="flag-chip">
        <code :title="id">{{ id }}</code>
        <button
          type="button"
          class="chip-remove"
          :aria-label="`Remove flag ${id}`"
          @click="removeFlag(id)">
          ×
        </button>
      </span>
    </div>
    <p v-else class="empty-note">No flags selected.</p>

    <div class="flag-add-row">
      <select v-model="pickValue" aria-label="Choose a known flag">
        <option value="">Choose a flag...</option>
        <option v-for="id in availableOptions" :key="id" :value="id">{{ id }}</option>
      </select>
      <button type="button" class="sm add-btn" :disabled="!pickValue" @click="addFromPicker">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round" />
        </svg>
        Add
      </button>
    </div>

    <div class="flag-add-row">
      <input
        v-model="writeIn"
        type="text"
        :placeholder="placeholder"
        aria-label="Write in a flag id"
        @keydown.enter.prevent="addFromWriteIn">
      <button type="button" class="sm add-btn" :disabled="!writeIn.trim()" @click="addFromWriteIn">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round" />
        </svg>
        Add
      </button>
    </div>
  </div>
</template>

<style scoped>
.flag-list-editor {
  display: grid;
  gap: 0.45rem;
}

.field-label {
  color: #bfc5cf;
  font-size: 0.82rem;
}

.flag-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.flag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.35rem 0.2rem 0.45rem;
  border: 1px solid #485267;
  border-radius: 999px;
  background: #171b22;
  color: #dbe2ea;
  font-size: 0.8rem;
}

.flag-chip code {
  color: #e7edf7;
  font-size: 0.78rem;
}

.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #aeb5c0;
  line-height: 1;
  cursor: pointer;
}

.chip-remove:hover {
  background: #2f3a4d;
  color: #ffb4b4;
}

.empty-note {
  margin: 0;
  color: #8e96a3;
  font-size: 0.82rem;
}

.flag-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: center;
}

input,
select {
  width: 100%;
  border: 1px solid #485267;
  border-radius: 6px;
  background: #171b22;
  color: #dbe2ea;
  padding: 0.45rem;
}
</style>
