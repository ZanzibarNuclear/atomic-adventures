<script setup>
defineProps({
  status: { type: String, default: "" },
  dirty: { type: Boolean, default: false },
  dirtyMessage: { type: String, default: "Unsaved changes" },
});
</script>

<template>
  <div v-if="status || dirty" class="builder-status-banners">
    <p v-if="status" class="status-banner">{{ status }}</p>
    <p v-if="dirty" class="dirty-banner">{{ dirtyMessage }}</p>
  </div>
</template>

<style scoped>
.builder-status-banners {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.status-banner,
.dirty-banner {
  margin: 0;
  padding: 0.55rem 0.75rem;
  border-radius: 7px;
}

.status-banner {
  background: #24344a;
  color: #b8d8ff;
}

.dirty-banner {
  background: #59481f;
  color: #ffe4a3;
}
</style>
