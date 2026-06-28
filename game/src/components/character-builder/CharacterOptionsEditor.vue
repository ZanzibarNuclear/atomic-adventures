<script setup>
defineProps({
  draft: { type: Object, required: true },
});

defineEmits(["add-group", "remove-group"]);
</script>

<template>
  <section class="options-editor">
    <header>
      <p class="label">Panel options</p>
      <h3>Groups and catalog organization</h3>
      <p class="intro">
        Stat and inventory groups organize entries in the player-facing character panel.
        They are shared options, not part of any single artifact.
      </p>
    </header>

    <section class="group-section">
      <h4>Stat groups</h4>
      <div v-for="group in draft.panel.statGroups" :key="group.id" class="group-row">
        <input v-model="group.id" aria-label="Stat group id">
        <input v-model="group.label" aria-label="Stat group label">
        <button class="sm muted" @click="$emit('remove-group', 'statGroups', group.id)">Remove</button>
      </div>
      <button class="sm" @click="$emit('add-group', 'statGroups')">Add stat group</button>
    </section>

    <section class="group-section">
      <h4>Inventory groups</h4>
      <div v-for="group in draft.panel.inventoryGroups" :key="group.id" class="group-row">
        <input v-model="group.id" aria-label="Inventory group id">
        <input v-model="group.label" aria-label="Inventory group label">
        <button class="sm muted" @click="$emit('remove-group', 'inventoryGroups', group.id)">Remove</button>
      </div>
      <button class="sm" @click="$emit('add-group', 'inventoryGroups')">Add inventory group</button>
    </section>
  </section>
</template>

<style scoped>
.options-editor {
  display: grid;
  gap: 1rem;
  max-width: 42rem;
}
header h3,
header p {
  margin: 0;
}
.intro {
  margin-top: 0.35rem;
  color: #aeb6c2;
  font-size: 0.9rem;
  line-height: 1.45;
}
.group-section h4 {
  margin: 0 0 0.5rem;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9eb4d4;
}
.group-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.35rem 0;
  flex-wrap: wrap;
}
.group-row input {
  min-width: 0;
  flex: 1;
}
</style>
