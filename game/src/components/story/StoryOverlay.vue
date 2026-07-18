<script setup>
import StoryCompletionCard from "./StoryCompletionCard.vue";

defineProps({
  completion: { type: Object, default: null },
});

defineEmits(["dismiss-completion"]);
</script>

<template>
  <div
    v-if="completion?.completion?.card"
    class="story-overlay"
    role="dialog"
    aria-modal="true">
    <StoryCompletionCard
      :card="completion.completion.card"
      @continue="$emit('dismiss-completion')" />
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
</style>
