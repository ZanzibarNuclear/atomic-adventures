<script setup>
defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
  setJson: { type: Function, required: true },
  setOptionalNumber: { type: Function, required: true },
});
</script>

<template>
  <div class="field-grid">
    <label>Type
      <select v-model="entry.type">
        <option>integer</option><option>decimal</option><option>meter</option>
        <option>boolean</option><option>enum</option>
      </select>
    </label>
    <label>Group
      <select v-model="entry.group">
        <option :value="null">No group</option>
        <option v-for="group in draft.panel.statGroups" :key="group.id" :value="group.id">
          {{ group.label }}
        </option>
      </select>
    </label>
    <label>Default<input v-model.number="entry.default" type="number"></label>
    <label>Minimum
      <input :value="entry.min" type="number" @input="setOptionalNumber(entry, 'min', $event)">
    </label>
    <label>Maximum
      <input :value="entry.max" type="number" @input="setOptionalNumber(entry, 'max', $event)">
    </label>
  </div>
  <label>Drift rates (JSON)
    <textarea
      :value="JSON.stringify(entry.drift ?? {}, null, 2)"
      rows="7"
      @change="setJson(entry, 'drift', $event, {})"></textarea>
  </label>
  <label>Thresholds (JSON)
    <textarea
      :value="JSON.stringify(entry.thresholds ?? [], null, 2)"
      rows="9"
      @change="setJson(entry, 'thresholds', $event, [])"></textarea>
  </label>
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; }
label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .82rem; }
@media (max-width: 720px) {
  .field-grid { grid-template-columns: 1fr; }
}
</style>
