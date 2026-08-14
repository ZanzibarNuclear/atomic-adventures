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
          type="button"
          class="sm"
          :class="tool === 'add-point' ? 'success-btn' : 'add-btn'"
          :aria-pressed="tool === 'add-point'"
          @click="toggleAddPointMode"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              v-if="tool !== 'add-point'"
              d="M12 5v14M5 12h14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
            />
            <path
              v-else
              d="M5 12.5 9.5 17 19 7.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ tool === "add-point" ? "Done adding points" : "Add point on map" }}
        </button>
      </div>
    </div>
    <article v-for="(point, index) in selected.points" :key="index" class="point-editor">
      <div class="point-heading">
        <strong>Point {{ index + 1 }}</strong>
        <div class="row-actions">
          <button type="button" class="sm muted" title="Move up" @click="movePoint(index, -1)">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button type="button" class="sm muted" title="Move down" @click="movePoint(index, 1)">
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            class="sm danger-outline"
            title="Remove point"
            :disabled="selected.points.length <= 2"
            @click="removePoint(index)"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
            </svg>
          </button>
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
