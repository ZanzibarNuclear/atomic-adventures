<template>
  <section class="play-panel">
    <slot />
  </section>
</template>

<style scoped>
/* Situation / play panel — status and choices below the map. */
.play-panel {
  display: grid;
  gap: 1rem;
  background: var(--color-bg-elevated);
  border: 1px solid color-mix(in srgb, var(--color-cherenkov) 14%, #2f3540);
  border-radius: 12px;
  padding: 1.25rem;
}
</style>
