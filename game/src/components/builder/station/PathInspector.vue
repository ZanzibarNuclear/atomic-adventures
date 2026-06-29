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
      <button class="sm" :class="{ active: addMode === 'point' }" @click="emit('toggle-path-add-mode', 'point')">
        Add waypoint
      </button>
      <button class="sm" :class="{ active: addMode === 'node' }" @click="emit('toggle-path-add-mode', 'node')">
        Add stand node
      </button>
      <button class="sm danger-outline" :disabled="!selectedHandleId" @click="emit('remove-selected-path-handle')">
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
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}
button.active { background: #49624f; border-color: #6f9b79; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
.danger-outline { border-color: #9b5050; color: #ffb5b5; background: #3d2729; }
</style>
