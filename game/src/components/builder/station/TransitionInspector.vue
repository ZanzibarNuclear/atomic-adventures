<script setup>
import {
  getExitMapAt,
  setExitMapAt,
} from "../../../lib/maps/composables/useGridBuilder.js";

defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});

function csvList(value) {
  return (value ?? []).join(", ");
}

function setCsvList(target, key, value) {
  target[key] = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setTransitionStand(target, value) {
  const stand = String(value ?? "").trim();
  if (stand) {
    target.standAt = { stand };
  } else {
    delete target.standAt;
  }
}
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selection.id }}</code>
    </div>
    <label>Label<input v-model="selection.entity.label" /></label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Regional side</h4>
    </div>
    <div class="field-grid">
      <label>Regional hex<input v-model="selection.entity.hex" /></label>
      <label>Regional stand ID
        <input
          :value="selection.entity.standAt?.stand ?? ''"
          placeholder="driveway"
          @input="setTransitionStand(selection.entity, $event.target.value)"
        />
      </label>
    </div>
    <label>Regional entry from hex IDs
      <input
        :value="csvList(selection.entity.entryFrom)"
        placeholder="south-pines, west-slope"
        @input="setCsvList(selection.entity, 'entryFrom', $event.target.value)"
      />
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Local side</h4>
    </div>
    <label>Local arrival stand
      <select v-model="selection.entity.exteriorNode">
        <option value="">Default entry</option>
        <option
          v-for="node in draft.exterior?.nodes ?? []"
          :key="node.id"
          :value="node.id"
        >
          {{ node.label || node.id }}
        </option>
      </select>
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Marker</h4>
    </div>
    <div class="field-grid">
      <label>Map X
        <input
          :value="getExitMapAt(selection.entity).x"
          type="number"
          step=".01"
          @input="setExitMapAt(draft, selection.id, Number($event.target.value), getExitMapAt(selection.entity).y)"
        />
      </label>
      <label>Map Y
        <input
          :value="getExitMapAt(selection.entity).y"
          type="number"
          step=".01"
          @input="setExitMapAt(draft, selection.id, getExitMapAt(selection.entity).x, Number($event.target.value))"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
</style>
