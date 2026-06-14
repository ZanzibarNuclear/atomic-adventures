<script setup>
defineProps({
  showEndCard: { type: Boolean, default: false },
});

defineEmits(["dismiss-end"]);
</script>

<template>
  <div
    v-if="showEndCard"
    class="story-overlay"
    role="dialog"
    aria-modal="true">
    <div class="story-panel">
      <p class="story-eyebrow">Day 1 complete</p>
      <h2 class="story-title">Shelter at last</h2>
      <p class="story-text">
        Zanzibar sleeps in the library while the cascade murmurs outside.
        Tomorrow holds answers — and perhaps a way to turn the lights back on.
      </p>
      <p class="story-note">
        To be continued — hydro power, the e-Buggy, and discoveries below.
      </p>
      <div class="story-actions">
        <button class="primary" @click="$emit('dismiss-end')">
          Continue exploring
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.story-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(8, 10, 14, 0.72);
  backdrop-filter: blur(4px);
}
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
