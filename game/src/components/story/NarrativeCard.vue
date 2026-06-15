<template>
  <section v-if="beat" class="narrative-card" aria-live="polite">
    <p v-if="beat.eyebrow" class="narrative-eyebrow">{{ beat.eyebrow }}</p>
    <h2 v-if="beat.heading" class="narrative-heading">{{ beat.heading }}</h2>
    <div class="narrative-body">{{ beat.text }}</div>
  </section>
</template>

<script setup>
defineProps({
  beat: { type: Object, default: null },
});
</script>

<style scoped>
.narrative-card {
  margin-bottom: 1rem;
  padding: 1.1rem 1.25rem;
  border-radius: 12px;
  border: 1px solid #3a4558;
  background: linear-gradient(180deg, #252b36 0%, #1e2430 100%);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
}
.narrative-eyebrow {
  margin: 0 0 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: #8bc49a;
}
.narrative-heading {
  margin: 0 0 0.75rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: #f0f2f5;
  line-height: 1.3;
}
.narrative-body {
  white-space: pre-wrap;
  line-height: 1.6;
  color: #c8cdd6;
  font-size: 0.94rem;
}
</style>
