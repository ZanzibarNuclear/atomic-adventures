<script setup>
defineProps({
  landmarkEditDraft: { type: Object, required: true },
});
</script>

<template>
  <label>Label<input v-model="landmarkEditDraft.label" /></label>
  <label>Icon<input v-model="landmarkEditDraft.icon" /></label>
  <label>Building ID<input v-model="landmarkEditDraft.building" /></label>
  <label>Blurb<textarea v-model="landmarkEditDraft.blurb" rows="4" /></label>
  <div class="field-grid">
    <label>Offset x<input v-model.number="landmarkEditDraft.dx" type="number" step=".01" /></label>
    <label>Offset y<input v-model.number="landmarkEditDraft.dy" type="number" step=".01" /></label>
  </div>
</template>
