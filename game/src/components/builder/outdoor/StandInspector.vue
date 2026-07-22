<script setup>
import { ref, watch } from "vue";
import LocationViewsEditor from "../LocationViewsEditor.vue";

const props = defineProps({
  selected: { type: Object, required: true },
  standEditDraft: { type: Object, required: true },
});

const emit = defineEmits(["drill-change"]);

const viewsDrilled = ref(false);

function setViewsDrilled(next) {
  viewsDrilled.value = Boolean(next);
  emit("drill-change", viewsDrilled.value);
}

watch(
  () => props.standEditDraft?.id,
  () => {
    setViewsDrilled(false);
  },
);
</script>

<template>
  <template v-if="!viewsDrilled">
    <section class="form-section">
      <div class="section-heading">
        <h4>Identity</h4>
        <code>{{ standEditDraft.id }}</code>
      </div>
      <label>ID<input v-model="standEditDraft.id" /></label>
      <label>Label<input v-model="standEditDraft.label" /></label>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h4>Position</h4>
      </div>
      <label>Anchor
        <select v-model="standEditDraft.anchor">
          <option value="hex">Hex-relative</option>
          <option value="landmark" :disabled="!selected.landmark">Landmark-relative</option>
          <option value="world">World coordinates</option>
        </select>
      </label>
      <div v-if="standEditDraft.anchor === 'world'" class="field-grid">
        <label>X<input v-model.number="standEditDraft.x" type="number" /></label>
        <label>Y<input v-model.number="standEditDraft.y" type="number" /></label>
      </div>
      <div v-else class="field-grid">
        <label>Offset x<input v-model.number="standEditDraft.dx" type="number" step=".01" /></label>
        <label>Offset y<input v-model.number="standEditDraft.dy" type="number" step=".01" /></label>
      </div>
    </section>
  </template>

  <LocationViewsEditor
    :owner="standEditDraft"
    title="Stand views"
    parent-label="stand"
    @drill-change="setViewsDrilled"
  />
</template>
