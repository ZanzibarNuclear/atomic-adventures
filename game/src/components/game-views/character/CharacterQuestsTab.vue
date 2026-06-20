<script setup>
defineProps({
  questsByStatus: { type: Object, required: true },
});

const questStatuses = ["active", "available", "completed", "failed"];
</script>

<template>
  <div v-if="Object.values(questsByStatus).some((entries) => entries.length)" class="quest-sections">
    <section
      v-for="status in questStatuses"
      v-show="questsByStatus[status].length"
      :key="status">
      <h3>{{ status.charAt(0).toUpperCase() + status.slice(1) }}</h3>
      <ul class="entry-list quest-list">
        <li v-for="quest in questsByStatus[status]" :key="quest.id">
          <strong>{{ quest.label }}</strong>
          <span v-if="quest.description">{{ quest.description }}</span>
          <ul v-if="quest.objectives.length" class="objective-list">
            <li v-for="objective in quest.objectives" :key="objective.id">
              <span v-if="objective.state.status === 'completed'" aria-hidden="true">&#10003;</span>
              <span v-else aria-hidden="true">&#9675;</span>
              <span>{{ objective.label }}</span>
              <small v-if="objective.target">
                {{ objective.state.count ?? 0 }} / {{ objective.target }}
              </small>
            </li>
          </ul>
        </li>
      </ul>
    </section>
  </div>
  <p v-else class="empty-state">No quests yet.</p>
</template>

<style scoped>
.quest-sections {
  display: grid;
  gap: 1.25rem;
}
h3 { margin: 0; }
.entry-list {
  display: grid;
  gap: 0.65rem;
  padding: 0;
  list-style: none;
}
.entry-list li {
  display: grid;
  gap: 0.25rem;
  padding: 0.85rem 1rem;
  border: 1px solid #394454;
  border-radius: 8px;
  background: rgba(24, 29, 37, 0.72);
}
.entry-list span,
.empty-state {
  color: #8f98a6;
}
.objective-list {
  display: grid;
  gap: .35rem;
  padding: .45rem 0 0;
  list-style: none;
}
.objective-list li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: .55rem;
  padding: .3rem 0;
  border: 0;
  background: transparent;
}
</style>
