<script setup>
defineProps({
  selected: { type: Object, required: true },
  featureLineKinds: { type: Array, required: true },
  addCascade: { type: Function, required: true },
  removeCascade: { type: Function, required: true },
});
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selected.id }}</code>
    </div>
    <label>Label<input v-model="selected.label" /></label>
    <label>Kind
      <select v-model="selected.kind">
        <option v-for="kind in featureLineKinds" :key="kind">{{ kind }}</option>
      </select>
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Geometry</h4>
    </div>
    <label>Flow<input v-model="selected.flow" /></label>
    <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
  </section>

  <section v-if="selected.kind === 'river'" class="form-section">
    <div class="section-heading">
      <h4>Cascades</h4>
    </div>
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
  </section>
</template>
