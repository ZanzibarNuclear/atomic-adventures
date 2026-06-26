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
  <label>Label
    <input
      :value="selection.entity.label"
      @input="setNodeLabel(draft, selection.id, $event.target.value)"
    />
  </label>
  <div class="field-grid">
    <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
    <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
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
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
</style>
