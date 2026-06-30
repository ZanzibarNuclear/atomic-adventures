<script setup>
defineProps({
  draft: { type: Object, required: true },
  entry: { type: Object, required: true },
  setJson: { type: Function, required: true },
  setOptionalNumber: { type: Function, required: true },
});
</script>

<template>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Stat behavior</h4>
      <code>{{ entry.type }}</code>
    </div>
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
      <label>Direction
        <select v-model="entry.direction">
          <option value="higher-is-better">Higher is better</option>
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
  </section>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Rules</h4>
      <code>JSON</code>
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
  </section>
</template>

<style scoped></style>
