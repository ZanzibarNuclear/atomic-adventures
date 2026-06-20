<script setup>
import { formatStatValue } from "../../../lib/character/panel.js";

defineProps({
  activeQuests: { type: Array, required: true },
  stats: { type: Array, required: true },
});
</script>

<template>
  <div class="overview-grid">
    <section class="panel-card">
      <h3>Status</h3>
      <dl v-if="stats.length" class="stat-list">
        <div v-for="stat in stats" :key="stat.id">
          <dt>{{ stat.label }}</dt>
          <dd>
            <meter
              v-if="stat.type === 'meter' && Number.isFinite(Number(stat.min)) && Number.isFinite(Number(stat.max))"
              :min="stat.min"
              :max="stat.max"
              :value="stat.value">
              {{ formatStatValue(stat) }}
            </meter>
            <span>{{ formatStatValue(stat) }}</span>
          </dd>
        </div>
      </dl>
      <p v-else class="empty-state">No character metrics are visible yet.</p>
    </section>

    <section class="panel-card">
      <h3>Active quests</h3>
      <ul v-if="activeQuests.length" class="summary-list">
        <li v-for="quest in activeQuests" :key="quest.id">
          <strong>{{ quest.label }}</strong>
          <span>{{ quest.state.status }}</span>
        </li>
      </ul>
      <p v-else class="empty-state">No active quests.</p>
    </section>
  </div>
</template>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.panel-card {
  padding: 1rem;
  border: 1px solid #394454;
  border-radius: 10px;
  background: rgba(24, 29, 37, 0.72);
}
h3 { margin: 0; }
.stat-list {
  display: grid;
  gap: 0.7rem;
  margin: 1rem 0 0;
}
.stat-list div,
.summary-list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.stat-list dt,
.empty-state {
  color: #8f98a6;
}
.stat-list dd {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0;
}
.stat-list meter {
  width: min(12rem, 28vw);
}
.summary-list {
  display: grid;
  gap: 0.65rem;
  padding: 0;
  list-style: none;
}
.summary-list span {
  color: #8bc49a;
  text-transform: capitalize;
}
@media (max-width: 720px) {
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
