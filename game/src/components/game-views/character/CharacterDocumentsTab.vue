<script setup>
defineProps({
  documents: { type: Array, required: true },
});
</script>

<template>
  <ul v-if="documents.length" class="entry-list document-list">
    <li v-for="document in documents" :key="document.id">
      <strong>{{ document.title }}</strong>
      <span v-if="document.summary">{{ document.summary }}</span>
      <p v-if="document.body">{{ document.body }}</p>
      <small>{{ document.state?.readAt ? "Read" : "Discovered" }}</small>
    </li>
  </ul>
  <p v-else class="empty-state">No documents discovered yet.</p>
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
.document-list small {
  color: #8bc49a;
}
.document-list p {
  margin: .45rem 0;
  white-space: pre-line;
}
</style>
