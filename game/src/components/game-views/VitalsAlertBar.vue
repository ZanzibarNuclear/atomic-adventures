<template>
  <section
    v-if="alerts.length"
    class="wellbeing-alerts"
    role="status"
    aria-label="Wellbeing warnings">
    <span class="wellbeing-alerts-label">Vitals</span>
    <span
      v-for="alert in alerts"
      :key="alert.id"
      class="wellbeing-chip"
      :class="alert.tone">
      {{ alert.label }}: {{ alert.state }}
    </span>
  </section>
</template>

<script setup>
defineProps({
  alerts: { type: Array, default: () => [] },
});
</script>

<style scoped>
.wellbeing-alerts {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  width: min(100%, 38rem);
  border: 1px solid #756143;
  background: #2f281e;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  margin: 0.45rem auto 0;
}
.wellbeing-alerts-label {
  color: #d7b77f;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
.wellbeing-chip {
  border: 1px solid #675640;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  color: #ffdca3;
  font-size: 0.82rem;
}
.wellbeing-chip.error {
  border-color: #8d4c4c;
  color: #ffabab;
}
</style>
