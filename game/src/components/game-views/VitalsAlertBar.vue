<template>
  <section
    v-if="alerts.length"
    class="wellbeing-alerts"
    role="status"
    aria-label="Vitals">
    <span class="wellbeing-alerts-label">Vitals</span>
    <span
      v-for="alert in alerts"
      :key="alert.id"
      class="wellbeing-chip"
      :class="[alert.tone, `status-${alert.status ?? alert.tone}`]"
      :aria-label="`${alert.label}: ${alert.state}`"
      :title="`${alert.label}: ${alert.state}`">
      {{ alert.state }}
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
  justify-content: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #756143;
  background: #2f281e;
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  margin: 0 0 0.55rem;
}
.wellbeing-alerts-label {
  color: #d7b77f;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
.wellbeing-chip {
  border: 1px solid #4f6f50;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  background: #14321d;
  color: #a8f0b2;
  font-size: 0.82rem;
}
.wellbeing-chip.status-good {
  border-color: #3f8a4b;
  background: #14351e;
  color: #a7efb1;
}
.wellbeing-chip.status-fine {
  border-color: #386f91;
  background: #132b3b;
  color: #9ed8ff;
}
.wellbeing-chip.status-caution {
  border-color: #9d842a;
  background: #3c3212;
  color: #ffe08a;
}
.wellbeing-chip.status-warning {
  border-color: #a45f25;
  background: #3e2112;
  color: #ffbc7a;
}
.wellbeing-chip.status-worst {
  border-color: #9a3e3e;
  background: #3d1717;
  color: #ff9a9a;
}
</style>
