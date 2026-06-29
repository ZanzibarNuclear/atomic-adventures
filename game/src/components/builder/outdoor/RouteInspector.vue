<script setup>
defineProps({
  selected: { type: Object, required: true },
  routeKinds: { type: Array, required: true },
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
        <option v-for="kind in routeKinds" :key="kind">{{ kind }}</option>
      </select>
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Geometry</h4>
    </div>
    <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
  </section>
</template>
