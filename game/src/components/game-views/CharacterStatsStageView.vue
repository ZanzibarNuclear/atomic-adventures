<script setup>
import { computed } from "vue";
import { formatStatValue } from "../../lib/character/panel.js";

const props = defineProps({
  stats: { type: Array, required: true },
  focus: { type: String, default: null },
});

defineEmits(["return-to-map"]);

const focusedStat = computed(() =>
  props.focus ? props.stats.find((stat) => stat.id === props.focus) ?? null : null,
);
</script>

<template>
  <section class="stage stats-stage" aria-labelledby="stats-stage-title">
    <header class="stage-header">
      <div>
        <p class="label">Character</p>
        <h2 id="stats-stage-title">{{ focusedStat ? focusedStat.label : "Current condition" }}</h2>
      </div>
      <button type="button" class="sm" @click="$emit('return-to-map')">Return to map</button>
    </header>

    <article v-if="focusedStat" class="focus-stat">
      <p class="stat-value">{{ formatStatValue(focusedStat) }}</p>
      <p v-if="focusedStat.description" class="stat-description">{{ focusedStat.description }}</p>
    </article>

    <div class="stat-grid">
      <article
        v-for="stat in stats"
        :key="stat.id"
        class="stat-card"
        :class="{ focused: focus === stat.id }">
        <span>{{ stat.label }}</span>
        <strong>{{ formatStatValue(stat) }}</strong>
      </article>
    </div>
  </section>
</template>

<style scoped>
.stats-stage {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid #2f3540;
  border-radius: 8px;
  background: #20242d;
}
.stage-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}
.stage-header h2 {
  margin: 0.1rem 0 0;
  font-size: 1.15rem;
}
.focus-stat {
  padding: 1rem;
  border: 1px solid #3d5944;
  border-radius: 8px;
  background: rgba(46, 71, 52, 0.55);
}
.stat-value {
  margin: 0;
  color: #f1f4f0;
  font-size: 2rem;
  font-weight: 700;
}
.stat-description {
  margin: 0.4rem 0 0;
  color: #c4cbbf;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.65rem;
}
.stat-card {
  display: grid;
  gap: 0.3rem;
  padding: 0.8rem;
  border: 1px solid #394454;
  border-radius: 8px;
  background: rgba(24, 29, 37, 0.72);
}
.stat-card.focused {
  border-color: #7cad87;
}
.stat-card span {
  color: #aab2bf;
}
.stat-card strong {
  color: #f0f2f5;
}
@media (max-width: 640px) {
  .stage-header {
    flex-direction: column;
  }
}
</style>
