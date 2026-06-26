<script setup>
defineProps({
  entries: { type: Array, required: true },
  selectedTab: { type: String, required: true },
});

function entryLabel(entry) {
  return entry.label ?? entry.title ?? entry.id;
}
</script>

<template>
  <ul v-if="entries.length" class="entry-list">
    <li
      v-for="entry in entries"
      :key="entry.id">
      <strong>{{ entryLabel(entry) }}</strong>
      <span v-if="entry.description">{{ entry.description }}</span>
      <small v-if="selectedTab === 'knowledge' && entry.sourceLabel">
        Learned from {{ entry.sourceLabel }}
      </small>
    </li>
  </ul>
  <p v-else class="empty-state">
    {{ selectedTab === "knowledge" ? "No knowledge acquired yet." : "Nothing to show here yet." }}
  </p>
</template>

<style scoped>
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
</style>
