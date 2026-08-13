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

  <section v-if="selected.kind === 'stream' || selected.kind === 'river'" class="form-section">
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
      <button type="button" class="sm danger-outline" @click="removeCascade(index)">
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
        </svg>
        Remove
      </button>
    </div>
    <button type="button" class="sm add-btn" @click="addCascade">
      <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
      </svg>
      Add cascade
    </button>
  </section>
</template>
