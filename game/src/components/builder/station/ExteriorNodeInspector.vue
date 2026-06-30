<script setup>
import { setNodeLabel } from "../../../lib/maps/composables/useGridBuilder.js";

defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});

function setOptionalField(target, key, value) {
  const next = String(value ?? "").trim();
  if (next) {
    target[key] = next;
  } else {
    delete target[key];
  }
}
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selection.id }}</code>
    </div>
    <label>Label
      <input
        :value="selection.entity.label"
        @input="setNodeLabel(draft, selection.id, $event.target.value)"
      />
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Position</h4>
    </div>
    <div class="field-grid">
      <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
      <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
    </div>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Connection</h4>
    </div>
    <label>Join node
      <select
        :value="selection.entity.joinNode ?? ''"
        @change="setOptionalField(selection.entity, 'joinNode', $event.target.value)"
      >
        <option value="">None</option>
        <option
          v-for="node in (draft.exterior?.nodes ?? []).filter((node) => node.id !== selection.id)"
          :key="node.id"
          :value="node.id"
        >
          {{ node.label || node.id }}
        </option>
      </select>
    </label>
  </section>
</template>

<style scoped>
.form-section {
  display: grid;
  gap: .55rem;
  padding: .65rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .65rem;
}
.section-heading h4 {
  margin: 0;
  color: #d7dde6;
  font-size: .78rem;
  font-weight: 700;
}
.section-heading code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #9da7b5;
  font-size: .74rem;
}
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
</style>
