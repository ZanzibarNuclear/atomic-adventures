<script setup>
defineProps({
  draft: { type: Object, required: true },
  selection: { type: Object, required: true },
});
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Rooms</h4>
      <code>{{ selection.id }}</code>
    </div>
    <label>From room
      <select v-model="selection.entity.from">
        <option v-for="room in draft.rooms" :key="room.id" :value="room.id">{{ room.id }}</option>
      </select>
    </label>
    <label>To room
      <select v-model="selection.entity.to">
        <option v-for="room in draft.rooms" :key="room.id" :value="room.id">{{ room.id }}</option>
      </select>
    </label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Connection</h4>
    </div>
    <label>Connection kind
      <select v-model="selection.entity.kind">
        <option value="open">Open</option>
        <option value="door">Door</option>
        <option value="stairs">Stairs</option>
        <option value="winding-stairs">Winding stairs</option>
      </select>
    </label>
    <label v-if="selection.entity.kind === 'door'">Door
      <select v-model="selection.entity.door">
        <option value="">Choose a door</option>
        <option v-for="door in draft.doors" :key="door.id" :value="door.id">{{ door.id }}</option>
      </select>
    </label>
  </section>
</template>
