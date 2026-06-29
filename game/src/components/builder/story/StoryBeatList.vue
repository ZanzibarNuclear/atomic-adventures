<script setup>
defineProps({
  selectedLocation: { type: String, default: "" },
  beats: { type: Array, default: () => [] },
  selectedBeatId: { type: String, default: "" },
  warnings: { type: Array, default: () => [] },
});

defineEmits(["new", "select"]);
</script>

<template>
  <section class="builder-list-column panel">
    <div class="section-heading">
      <div>
        <p class="label">Selected location</p>
        <h2>{{ selectedLocation }}</h2>
      </div>
      <button class="sm" @click="$emit('new')">New beat</button>
    </div>
    <button
      v-for="beat in beats"
      :key="beat.id"
      class="beat-list-item"
      :class="{ active: selectedBeatId === beat.id }"
      @click="$emit('select', beat.id)"
    >
      <strong>{{ beat.heading || beat.id }}</strong>
      <span>{{ beat.id }}</span>
      <small v-if="beat.match?.originHex">from {{ beat.match.originHex }}</small>
      <small v-if="beat.match?.mapTransition || beat.match?.localExit">
        map transition {{ beat.match.mapTransition || beat.match.localExit }}
      </small>
      <small v-if="beat.match?.transitionDirection">
        {{ beat.match.transitionDirection === "toLocal" ? "to local map" : "to regional map" }}
      </small>
    </button>
    <p v-if="!beats.length" class="empty-note">No beats are attached here yet.</p>
    <p v-for="warning in warnings" :key="warning" class="builder-warning">{{ warning }}</p>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
  border: 1px solid #343d4d;
  border-radius: 10px;
  background: #20252f;
  padding: 0.85rem;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.label {
  color: #8e96a3;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.beat-list-item {
  display: grid;
  width: 100%;
  gap: 0.15rem;
  margin-top: 0.5rem;
  text-align: left;
}

.beat-list-item.active {
  background: #49624f;
  border-color: #6f9b79;
}

.empty-note,
.builder-warning {
  color: #aeb5c0;
  font-size: 0.9rem;
}

.builder-warning {
  color: #ffc66d;
}
</style>
