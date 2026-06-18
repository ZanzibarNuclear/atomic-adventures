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
  background: #20242d;
  border: 1px solid #2f3540;
  border-radius: 12px;
  padding: 1.25rem;
}
</style>
