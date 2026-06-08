<template>
  <section class="hud">
    <slot />
  </section>
</template>

<style scoped>
.hud {
  display: grid;
  gap: 1rem;
  background: #20242d;
  border: 1px solid #2f3540;
  border-radius: 12px;
  padding: 1.25rem;
}
</style>
