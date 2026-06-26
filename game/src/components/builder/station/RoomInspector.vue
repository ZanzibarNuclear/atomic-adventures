<script setup>
import { setRoomLabel } from "../../../lib/maps/composables/useGridBuilder.js";

defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});
</script>

<template>
  <label>Label
    <input
      :value="selection.entity.label"
      @input="setRoomLabel(draft, selection.id, $event.target.value)"
    />
  </label>
  <div class="field-grid">
    <label>X<input v-model.number="selection.entity.x" type="number" step=".5" /></label>
    <label>Y<input v-model.number="selection.entity.y" type="number" step=".5" /></label>
    <label>Width<input v-model.number="selection.entity.w" type="number" min=".5" step=".5" /></label>
    <label>Height<input v-model.number="selection.entity.h" type="number" min=".5" step=".5" /></label>
  </div>
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
</style>
