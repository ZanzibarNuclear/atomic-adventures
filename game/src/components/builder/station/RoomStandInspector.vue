<script setup>
defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});
</script>

<template>
  <label>Label<input v-model="selection.entity.label" /></label>
  <div class="field-grid">
    <label>X<input v-model.number="selection.entity.at.x" type="number" step=".01" /></label>
    <label>Y<input v-model.number="selection.entity.at.y" type="number" step=".01" /></label>
  </div>
  <label>Pose<input v-model="selection.entity.pose" placeholder="stand or sit" /></label>
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
</template>

<style scoped>
.field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; }
.check-field { display: flex !important; align-items: center; }
.check-field input { width: auto; }
</style>
