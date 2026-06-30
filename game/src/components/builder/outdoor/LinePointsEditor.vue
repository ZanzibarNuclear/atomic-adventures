<script setup>
defineProps({
  selected: { type: Object, required: true },
  tool: { type: String, required: true },
  allHexIds: { type: Array, required: true },
  pointMode: { type: Function, required: true },
  setPointMode: { type: Function, required: true },
  toggleAddPointMode: { type: Function, required: true },
  movePoint: { type: Function, required: true },
  removePoint: { type: Function, required: true },
});
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Control points</h4>
      <div class="point-tools">
        <button
          class="sm"
          :class="{ active: tool === 'add-point' }"
          @click="toggleAddPointMode"
        >
          {{ tool === "add-point" ? "Done adding points" : "Add point on map" }}
        </button>
      </div>
    </div>
    <article v-for="(point, index) in selected.points" :key="index" class="point-editor">
      <div class="point-heading">
        <strong>Point {{ index + 1 }}</strong>
        <div class="row-actions">
          <button class="sm muted" @click="movePoint(index, -1)">↑</button>
          <button class="sm muted" @click="movePoint(index, 1)">↓</button>
          <button class="sm muted" :disabled="selected.points.length <= 2" @click="removePoint(index)">×</button>
        </div>
      </div>
      <select :value="pointMode(point)" @change="setPointMode(point, $event.target.value)">
        <option value="hex">Hex anchor</option><option value="raw">World coordinates</option>
      </select>
      <template v-if="point.hex != null">
        <select v-model="point.hex"><option v-for="id in allHexIds" :key="id">{{ id }}</option></select>
        <div class="field-grid">
          <input v-model.number="point.dx" type="number" step=".01" aria-label="Point dx" />
          <input v-model.number="point.dy" type="number" step=".01" aria-label="Point dy" />
        </div>
      </template>
      <div v-else class="field-grid">
        <input v-model.number="point.x" type="number" aria-label="Point x" />
        <input v-model.number="point.y" type="number" aria-label="Point y" />
      </div>
    </article>
  </section>
</template>
