<script setup>
import { setRollDoorProps } from "../../../lib/maps/composables/useGridBuilder.js";

defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
  characterCatalog: { type: Object, required: true },
  rollDoorRoom: { type: Object, default: null },
});
</script>

<template>
  <label>Label<input v-model="selection.entity.label" /></label>
  <label>Key item
    <select
      :value="selection.entity.lock?.key ?? ''"
      @change="
        selection.entity.lock ??= {};
        selection.entity.lock.key = $event.target.value || null
      ">
      <option value="">No key</option>
      <option
        v-for="item in characterCatalog.items"
        :key="item.id"
        :value="item.id">
        {{ item.label }} ({{ item.id }})
      </option>
    </select>
  </label>
  <template v-if="selection.entity.kind === 'man'">
    <div class="field-grid">
      <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
      <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
    </div>
    <label class="check-field">
      <input v-model="selection.entity.vertical" type="checkbox" />
      Vertical
    </label>
  </template>
  <template v-else-if="rollDoorRoom">
    <label>Wall
      <select
        :value="rollDoorRoom.rollDoor"
        @change="setRollDoorProps(draft, selection.id, { edge: $event.target.value })"
      >
        <option>north</option><option>east</option><option>south</option><option>west</option>
      </select>
    </label>
    <label>Span
      <input
        :value="rollDoorRoom.rollSpan"
        type="number"
        min=".1"
        max="1"
        step=".05"
        @input="setRollDoorProps(draft, selection.id, { rollSpan: Number($event.target.value) })"
      />
    </label>
  </template>
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
</style>
