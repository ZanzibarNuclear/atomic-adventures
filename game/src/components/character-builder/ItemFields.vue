<script setup>
defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
  setCsv: { type: Function, required: true },
  setJson: { type: Function, required: true },
});
</script>

<template>
  <div class="field-grid">
    <label>Kind<input v-model="entry.kind"></label>
    <label>Group
      <select v-model="entry.group">
        <option :value="null">No group</option>
        <option
          v-for="group in draft.panel.inventoryGroups"
          :key="group.id"
          :value="group.id">{{ group.label }}</option>
      </select>
    </label>
    <label>Carrying
      <select v-model="entry.carrying">
        <option value="unique">Unique</option>
        <option value="stack">Stack</option>
      </select>
    </label>
    <label>Maximum quantity
      <input v-model.number="entry.maxQuantity" type="number" min="1">
    </label>
    <label>Icon asset<input v-model="entry.icon"></label>
    <label>Related document
      <select v-model="entry.relatedDocument">
        <option :value="null">None</option>
        <option v-for="document in draft.documents" :key="document.id" :value="document.id">
          {{ document.title }}
        </option>
      </select>
    </label>
  </div>
  <label>Tags
    <input :value="entry.tags.join(', ')" @input="setCsv(entry, 'tags', $event)">
  </label>
  <label class="check-field"><input v-model="entry.portable" type="checkbox"> Portable</label>
  <label>Properties (JSON)
    <textarea
      :value="JSON.stringify(entry.properties ?? {}, null, 2)"
      rows="6"
      @change="setJson(entry, 'properties', $event, {})"></textarea>
  </label>
  <label>Item actions (JSON)
    <textarea
      :value="JSON.stringify(entry.actions ?? [], null, 2)"
      rows="12"
      @change="setJson(entry, 'actions', $event, [])"></textarea>
  </label>
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; }
label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .82rem; }
.check-field { display: flex; align-items: center; }
@media (max-width: 720px) {
  .field-grid { grid-template-columns: 1fr; }
}
</style>
