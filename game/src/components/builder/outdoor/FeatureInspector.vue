<script setup>
defineProps({
  selected: { type: Object, required: true },
  featureLineKinds: { type: Array, required: true },
  addCascade: { type: Function, required: true },
  removeCascade: { type: Function, required: true },
});
</script>

<template>
  <label>Kind
    <select v-model="selected.kind">
      <option v-for="kind in featureLineKinds" :key="kind">{{ kind }}</option>
    </select>
  </label>
  <label>Label<input v-model="selected.label" /></label>
  <label>Flow<input v-model="selected.flow" /></label>
  <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
  <fieldset v-if="selected.kind === 'river'">
    <legend>Cascades</legend>
    <div
      v-for="(cascade, index) in selected.cascades ?? []"
      :key="cascade.id ?? index"
      class="cascade-row"
    >
      <label>ID<input v-model="cascade.id" /></label>
      <label>From<input v-model.number="cascade.from" type="number" min="0" max="1" step=".01" /></label>
      <label>To<input v-model.number="cascade.to" type="number" min="0" max="1" step=".01" /></label>
      <button class="sm danger-outline" @click="removeCascade(index)">Remove</button>
    </div>
    <button class="sm" @click="addCascade">Add cascade</button>
  </fieldset>
</template>
