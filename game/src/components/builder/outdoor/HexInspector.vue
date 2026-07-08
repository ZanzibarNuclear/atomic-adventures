<script setup>
import { normalizeStandEntries } from "../../../lib/maps/composables/useAvatarStand.js";
import LocationViewsEditor from "../LocationViewsEditor.vue";

defineProps({
  selected: { type: Object, required: true },
  terrainKinds: { type: Array, required: true },
  landmarkDraft: { type: Object, default: null },
  standDraft: { type: Object, default: null },
  select: { type: Function, required: true },
  beginAddLandmark: { type: Function, required: true },
  confirmAddLandmark: { type: Function, required: true },
  cancelLandmarkDraft: { type: Function, required: true },
  beginAddStand: { type: Function, required: true },
  confirmAddStand: { type: Function, required: true },
  cancelStandDraft: { type: Function, required: true },
});
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selected.id }}</code>
    </div>
    <label>Display label<input v-model="selected.label" /></label>
    <label>Terrain
      <select v-model="selected.terrain">
        <option v-for="kind in terrainKinds" :key="kind">{{ kind }}</option>
      </select>
    </label>
  </section>

  <section class="form-section">
    <div class="subitem-heading">
      <strong>Landmark</strong>
      <button v-if="!selected.landmark && !landmarkDraft" class="sm" @click="beginAddLandmark">Add landmark</button>
    </div>
    <button
      v-if="selected.landmark"
      class="subitem-row"
      @click="select('landmark', selected.id)"
    >
      <strong>{{ selected.landmark.label || selected.landmark.building || selected.landmark.icon || "Landmark" }}</strong>
      <span>{{ selected.landmark.building || selected.landmark.icon || "custom" }}</span>
    </button>
    <div v-if="landmarkDraft" class="draft-card">
      <div class="section-heading">
        <h4>New landmark</h4>
      </div>
      <label>Label<input v-model="landmarkDraft.label" /></label>
      <label>Icon<input v-model="landmarkDraft.icon" /></label>
      <label>Building ID<input v-model="landmarkDraft.building" /></label>
      <label>Blurb<textarea v-model="landmarkDraft.blurb" rows="3" /></label>
      <div class="field-grid">
        <label>Offset x<input v-model.number="landmarkDraft.dx" type="number" step=".01" /></label>
        <label>Offset y<input v-model.number="landmarkDraft.dy" type="number" step=".01" /></label>
      </div>
      <div class="row-actions">
        <button class="sm" @click="confirmAddLandmark">Confirm</button>
        <button class="sm muted" @click="cancelLandmarkDraft">Cancel</button>
      </div>
    </div>
  </section>

  <LocationViewsEditor
    :owner="selected"
    title="Hex views"
  />
  <section class="form-section">
    <div class="subitem-heading">
      <strong>Stand points</strong>
      <button v-if="!standDraft" class="sm" @click="beginAddStand">Add stand</button>
    </div>
    <button
      v-for="stand in normalizeStandEntries(selected)"
      :key="stand.id"
      class="subitem-row"
      @click="select('stand', `${selected.id}:${stand.id}`)"
    >
      <strong>{{ stand.label || stand.id }}</strong>
      <span>{{ stand.id }}</span>
    </button>
    <div v-if="standDraft" class="draft-card">
      <div class="section-heading">
        <h4>New stand</h4>
      </div>
      <label>ID<input v-model="standDraft.id" /></label>
      <label>Label<input v-model="standDraft.label" /></label>
      <label>Anchor
        <select v-model="standDraft.anchor">
          <option value="hex">Hex-relative</option>
          <option value="landmark" :disabled="!selected.landmark">Landmark-relative</option>
          <option value="world">World coordinates</option>
        </select>
      </label>
      <div v-if="standDraft.anchor === 'world'" class="field-grid">
        <label>X<input v-model.number="standDraft.x" type="number" /></label>
        <label>Y<input v-model.number="standDraft.y" type="number" /></label>
      </div>
      <div v-else class="field-grid">
        <label>Offset x<input v-model.number="standDraft.dx" type="number" step=".01" /></label>
        <label>Offset y<input v-model.number="standDraft.dy" type="number" step=".01" /></label>
      </div>
      <div class="row-actions">
        <button class="sm" @click="confirmAddStand">Confirm</button>
        <button class="sm muted" @click="cancelStandDraft">Cancel</button>
      </div>
    </div>
  </section>
</template>
