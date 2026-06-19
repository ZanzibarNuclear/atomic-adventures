<script setup>
defineEmits(["return-to-map"]);
</script>

<template>
  <section class="character-view" aria-labelledby="character-view-title">
    <div class="character-view-header">
      <div>
        <p class="label">Character</p>
        <h2 id="character-view-title">Zanzibar Nuhero</h2>
      </div>
      <button type="button" @click="$emit('return-to-map')">Return to map</button>
    </div>

    <div class="character-placeholder">
      <p>
        Character status, inventory, knowledge, skills, quests, and documents
        will appear here as their authored systems are added.
      </p>
    </div>
  </section>
</template>

<style scoped>
.character-view {
  min-height: var(--map-height);
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #3f4c63;
  border-radius: 12px;
  background: #20252e;
}
.character-view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.character-view h2 {
  margin: 0.2rem 0 0;
}
.character-placeholder {
  display: grid;
  min-height: 14rem;
  place-items: center;
  color: #9aa0ac;
  text-align: center;
}
</style>
