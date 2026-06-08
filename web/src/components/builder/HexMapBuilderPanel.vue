<template>
  <BuilderPanel>
    <span class="label">Edit</span>
    <select
      :value="editSelection"
      class="builder-select"
      @change="$emit('update:editSelection', $event.target.value)">
      <optgroup label="Buildings &amp; stands">
        <option
          v-for="item in editableItems.filter((l) => l.source === 'hexes')"
          :key="item.id"
          :value="`${item.source}:${item.id}`">
          {{ item.label }}
        </option>
      </optgroup>
      <optgroup label="Routes">
        <option
          v-for="line in editableItems.filter((l) => l.source === 'routes')"
          :key="line.id"
          :value="`${line.source}:${line.id}`">
          {{ line.label }} ({{ line.kind }})
        </option>
      </optgroup>
      <optgroup label="Features">
        <option
          v-for="line in editableItems.filter((l) => l.source === 'features')"
          :key="line.id"
          :value="`${line.source}:${line.id}`">
          {{ line.label }} ({{ line.kind }})
        </option>
      </optgroup>
    </select>

    <BuilderLineActions
      v-if="editMode === 'line'"
      :smooth="editParsed?.line?.smooth"
      add-point-label="click to add point"
      delete-point-label="Delete point"
      :can-delete-point="!!selectedHandleId?.startsWith('point-')"
      @toggle-smooth="$emit('toggle-smooth')"
      :add-point-mode="addPointMode"
      @update:add-point-mode="$emit('update:addPointMode', $event)"
      @delete-point="$emit('delete-point')" />

    <div v-if="editMode === 'placement'" class="builder-actions">
      <label
        v-if="hasLandmarkMarker(editParsed?.hex)"
        class="mode-pill sm"
        :class="{ active: standAnchoredToLandmark }">
        <input
          type="checkbox"
          :checked="standAnchoredToLandmark"
          @change="$emit('toggle-stand-anchor')" />
        stand follows building
      </label>
    </div>

    <p class="builder-hint builder-export-note">
      Paste each section into <code>map.yaml</code>, replacing the matching block
      (<code>hexes:</code>, <code>features:</code>, or <code>routes:</code>).
      Copy hexes replaces the <em>entire</em> hex list — save the file and the
      map reloads automatically.
    </p>

    <p class="builder-hint">
      <template v-if="editMode === 'placement'">
        <span class="handle-key landmark">●</span> purple = building icon —
        <span class="handle-key stand">●</span> green = player stand. Drag to
        reposition; enable “stand follows building” so the player stays beside
        the icon when you move it.
      </template>
      <template v-else-if="editMode === 'line'">
        Drag yellow handles to reshape the line. Dashed guide = control points;
        solid stroke uses smoothing when enabled.
        <template v-if="editHandles.length">
          {{ editHandles.length }} points
          <template v-if="selectedHandleId">
            — selected {{ selectedHandleId }}
          </template>
        </template>
      </template>
    </p>

    <BuilderExportBar
      :buttons="exportButtons"
      :status="exportStatus"
      @action="$emit('export', $event)" />
  </BuilderPanel>
</template>

<script setup>
import BuilderPanel from "./BuilderPanel.vue";
import BuilderLineActions from "./BuilderLineActions.vue";
import BuilderExportBar from "./BuilderExportBar.vue";

defineProps({
  editableItems: { type: Array, required: true },
  editSelection: { type: String, default: "" },
  editMode: { type: String, default: null },
  editParsed: { type: Object, default: null },
  editHandles: { type: Array, default: () => [] },
  selectedHandleId: { type: String, default: null },
  addPointMode: { type: Boolean, default: false },
  standAnchoredToLandmark: { type: Boolean, default: false },
  exportStatus: { type: String, default: "" },
  hasLandmarkMarker: { type: Function, required: true },
});

defineEmits([
  "update:editSelection",
  "update:addPointMode",
  "toggle-smooth",
  "toggle-stand-anchor",
  "delete-point",
  "export",
]);

const exportButtons = [
  { key: "hexes", label: "Copy hexes" },
  { key: "features", label: "Copy features" },
  { key: "routes", label: "Copy routes" },
  { key: "both", label: "Copy all" },
  { key: "download", label: "Download" },
  { key: "reset", label: "Reset", muted: true },
];
</script>

<style scoped>
.builder-select {
  width: 100%;
  max-width: 420px;
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.88rem;
}
.builder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.builder-hint {
  margin: 0;
  color: #8a919e;
  font-size: 0.82rem;
  line-height: 1.45;
}
.handle-key {
  font-weight: 700;
}
.handle-key.landmark {
  color: #c792ea;
}
.handle-key.stand {
  color: #7dcea0;
}
</style>
