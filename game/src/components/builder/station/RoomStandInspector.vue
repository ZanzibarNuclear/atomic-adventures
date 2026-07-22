<script setup>
import { ref, watch } from "vue";
import LocationViewsEditor from "../LocationViewsEditor.vue";

const props = defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});

const emit = defineEmits(["drill-change"]);

const viewsDrilled = ref(false);

function setViewsDrilled(next) {
  viewsDrilled.value = Boolean(next);
  emit("drill-change", viewsDrilled.value);
}

watch(
  () => props.selection?.id,
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
        <code>{{ selection.entity.id }}</code>
      </div>
      <label>Label<input v-model="selection.entity.label" /></label>
      <label>Pose<input v-model="selection.entity.pose" placeholder="stand or sit" /></label>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h4>Position</h4>
      </div>
      <div class="field-grid">
        <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
        <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
      </div>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h4>Behavior</h4>
      </div>
      <label>Interaction
        <input v-model="selection.entity.interaction" placeholder="optional semantic ID" />
      </label>
      <label class="check-field">
        <input
          type="checkbox"
          :checked="
            draft.rooms.find((room) => room.id === selection.id.split('/')[0])
              ?.defaultStand === selection.entity.id
          "
          @change="
            draft.rooms.find((room) => room.id === selection.id.split('/')[0]).defaultStand =
              $event.target.checked ? selection.entity.id : null
          "
        />
        Default room stand
      </label>
    </section>
  </template>

  <LocationViewsEditor
    :owner="selection.entity"
    title="Stand views"
    parent-label="stand"
    @drill-change="setViewsDrilled"
  />
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
</style>
