<script setup>
defineProps({
  entry: { type: Object, required: true },
  setCsv: { type: Function, required: true },
  setJson: { type: Function, required: true },
});
</script>

<template>
  <div class="field-grid">
    <label>Mode
      <select v-model="entry.mode">
        <option value="acquired">Acquired</option>
        <option value="ranked">Ranked</option>
      </select>
    </label>
    <label>Maximum rank<input v-model.number="entry.maxRank" type="number" min="1"></label>
  </div>
  <label>Rank labels
    <input
      :value="(entry.rankLabels ?? []).join(', ')"
      @input="setCsv(entry, 'rankLabels', $event)">
  </label>
  <label>Practice and award rules (JSON)
    <textarea
      :value="JSON.stringify(entry.practice ?? { evidence: [], awards: [] }, null, 2)"
      rows="16"
      @change="setJson(entry, 'practice', $event, { evidence: [], awards: [] })"></textarea>
  </label>
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .6rem; }
label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .82rem; }
@media (max-width: 720px) {
  .field-grid { grid-template-columns: 1fr; }
}
</style>
