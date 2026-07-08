<script setup>
defineProps({
  entry: { type: Object, required: true },
  setJson: { type: Function, required: true },
});
</script>

<template>
  <section class="field-panel">
    <div class="section-heading">
      <h4>Quest rules</h4>
      <code>{{ entry.objectives?.length ?? 0 }} objectives</code>
    </div>
    <label class="check-field">
      <input v-model="entry.autoComplete" type="checkbox">
      Complete quest when every objective is complete
    </label>
    <label>Objectives (JSON)
      <textarea
        :value="JSON.stringify(entry.objectives, null, 2)"
        rows="10"
        @change="setJson(entry, 'objectives', $event, [])"></textarea>
    </label>
  </section>
</template>

<style scoped></style>
