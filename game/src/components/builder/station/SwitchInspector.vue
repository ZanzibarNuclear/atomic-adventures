<script setup>
defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selection.id }}</code>
    </div>
    <label>Label<input v-model="selection.entity.label" placeholder="Manual release large roll-up"></label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Switch target</h4>
    </div>
    <label>Room
      <select v-model="selection.entity.room">
        <option v-for="room in draft.rooms" :key="room.id" :value="room.id">
          {{ room.label || room.id }} ({{ room.id }})
        </option>
      </select>
    </label>
    <label>Door
      <select v-model="selection.entity.door">
        <option v-for="door in draft.doors" :key="door.id" :value="door.id">
          {{ door.label || door.id }} ({{ door.id }})
        </option>
      </select>
    </label>
  </section>
</template>
