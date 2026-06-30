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
      <div class="section-heading">
        <h4>Stat groups</h4>
        <code>{{ draft.panel.statGroups.length }} groups</code>
      </div>
      <div v-for="group in draft.panel.statGroups" :key="group.id" class="group-row">
        <label>ID<input v-model="group.id" aria-label="Stat group id"></label>
        <label>Label<input v-model="group.label" aria-label="Stat group label"></label>
        <button class="sm muted" @click="$emit('remove-group', 'statGroups', group.id)">Remove</button>
      </div>
      <button class="sm" @click="$emit('add-group', 'statGroups')">Add stat group</button>
    </section>

    <section class="group-section">
      <div class="section-heading">
        <h4>Inventory groups</h4>
        <code>{{ draft.panel.inventoryGroups.length }} groups</code>
      </div>
      <div v-for="group in draft.panel.inventoryGroups" :key="group.id" class="group-row">
        <label>ID<input v-model="group.id" aria-label="Inventory group id"></label>
        <label>Label<input v-model="group.label" aria-label="Inventory group label"></label>
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
.group-section {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid #343d4d;
  border-radius: 8px;
  background: #1b2028;
}
.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.65rem;
}
.group-section h4 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: #d7dde6;
}
.section-heading code {
  color: #9da7b5;
  font-size: 0.74rem;
}
.group-row {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr) auto;
  gap: 0.55rem;
  align-items: end;
  padding: 0.55rem;
  border: 1px solid #343d4d;
  border-radius: 7px;
  background: #202733;
}
label {
  display: grid;
  gap: 0.35rem;
  color: #bdc4ce;
  font-size: 0.8rem;
}
input {
  width: 100%;
  min-width: 0;
  border: 1px solid #485267;
  border-radius: 7px;
  background: #171b22;
  color: #eef1f5;
  padding: 0.5rem 0.6rem;
  font: inherit;
}
input:focus {
  outline: 2px solid #6ea57b;
  outline-offset: 1px;
  border-color: #6ea57b;
}
@media (max-width: 720px) {
  .group-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}
</style>
