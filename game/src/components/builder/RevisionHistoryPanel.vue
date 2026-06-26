<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: "Revision history" },
  revisions: { type: Array, default: () => [] },
});

defineEmits(["restore"]);
</script>

<template>
  <section v-if="visible" class="history">
    <h3>{{ title }}</h3>
    <button
      v-for="revision in revisions"
      :key="revision.revision"
      type="button"
      class="revision-item"
      @click="$emit('restore', revision.revision)"
    >
      r{{ revision.revision }} · {{ revision.operation }} ·
      {{ new Date(revision.createdAt).toLocaleString() }}
    </button>
    <p v-if="!revisions.length" class="empty-note">No revisions yet.</p>
  </section>
</template>

<style scoped>
.history {
  display: grid;
  gap: 0.5rem;
}

h3 {
  margin: 0;
}

.revision-item {
  width: 100%;
  text-align: left;
}

.empty-note {
  margin: 0;
  color: #6a756d;
}
</style>
