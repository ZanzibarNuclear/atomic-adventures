<script setup>
defineProps({
  entry: { type: Object, required: true },
  setJson: { type: Function, required: true },
});
</script>

<template>
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
</template>

<style scoped>
label { display: grid; gap: .3rem; color: #bdc4ce; font-size: .82rem; }
.check-field { display: flex; align-items: center; }
</style>
