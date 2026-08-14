<script setup>
import { setNodeLabel } from "../../../lib/maps/composables/useGridBuilder.js";

defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
  selectedHandleId: { type: String, default: null },
  selectedPathNode: { type: Object, default: null },
  addMode: { type: String, default: null },
});

const emit = defineEmits(["toggle-path-add-mode", "remove-selected-path-handle"]);
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selection.id }}</code>
    </div>
    <label class="check-field">
      <input v-model="selection.entity.smooth" type="checkbox" />
      Smooth path
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Geometry</h4>
    </div>
    <div class="row-actions">
      <button
        type="button"
        class="sm"
        :class="addMode === 'point' ? 'success-btn' : 'add-btn'"
        :aria-pressed="addMode === 'point'"
        @click="emit('toggle-path-add-mode', 'point')"
      >
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
        {{ addMode === "point" ? "Done adding points" : "Add waypoint" }}
      </button>
      <button
        type="button"
        class="sm"
        :class="addMode === 'node' ? 'success-btn' : 'add-btn'"
        :aria-pressed="addMode === 'node'"
        @click="emit('toggle-path-add-mode', 'node')"
      >
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
        </svg>
        {{ addMode === "node" ? "Done adding stands" : "Add stand node" }}
      </button>
      <button
        type="button"
        class="sm danger-outline"
        :disabled="!selectedHandleId"
        @click="emit('remove-selected-path-handle')"
      >
        <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        </svg>
        Delete selected handle
      </button>
    </div>
    <label v-if="selectedPathNode">Node label
      <input
        :value="selectedPathNode.label"
        @input="setNodeLabel(draft, selectedPathNode.id, $event.target.value)"
      />
    </label>
  </section>
</template>

<style scoped>
.row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
</style>
