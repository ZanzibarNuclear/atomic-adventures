<script setup>
defineProps({
  card: { type: Object, required: true },
});

defineEmits(["continue"]);
</script>

<template>
  <section class="story-panel">
    <p v-if="card.eyebrow" class="story-eyebrow">{{ card.eyebrow }}</p>
    <h2 class="story-title">{{ card.heading }}</h2>
    <p class="story-text">{{ card.description }}</p>
    <p v-if="card.note" class="story-note">{{ card.note }}</p>
    <div class="story-actions">
      <button class="primary" @click="$emit('continue')">{{ card.actionLabel }}</button>
    </div>
  </section>
</template>

<style scoped>
.story-panel {
  max-width: 36rem;
  width: 100%;
  padding: 1.5rem 1.35rem;
  border-radius: 12px;
  border: 1px solid #3f4c63;
  background: #1e2430;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}
.story-eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: #8bc49a;
}
.story-title {
  margin: 0 0 0.85rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #f0f2f5;
}
.story-text {
  margin: 0 0 1.25rem;
  white-space: pre-wrap;
  line-height: 1.55;
  color: #c8cdd6;
  font-size: 0.95rem;
}
.story-note {
  margin: -0.75rem 0 1.25rem;
  font-size: 0.85rem;
  color: #9aa0ac;
  font-style: italic;
}
.story-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
button.primary {
  background: #3a5a3f;
  border-color: #4e7a55;
}
button.primary:hover {
  background: #46694c;
}
</style>
