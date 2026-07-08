<script setup>
defineProps({
  entry: { type: Object, required: true },
  setCsv: { type: Function, required: true },
  setJson: { type: Function, required: true },
});
</script>

<template>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Skill behavior</h4>
      <code>{{ entry.mode }}</code>
    </div>
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
  </section>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Practice and awards</h4>
      <code>JSON</code>
    </div>
    <label>Practice and award rules (JSON)
      <textarea
        :value="JSON.stringify(entry.practice ?? { evidence: [], awards: [] }, null, 2)"
        rows="16"
        @change="setJson(entry, 'practice', $event, { evidence: [], awards: [] })"></textarea>
    </label>
  </section>
</template>

<style scoped></style>
