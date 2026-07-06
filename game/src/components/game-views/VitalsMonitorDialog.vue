<script setup>
import { computed } from "vue";
import { formatGameClock } from "../../lib/character/gameTime.js";
import { formatVitalValue } from "../../lib/character/panel.js";

const props = defineProps({
  overview: { type: Object, required: true },
  clock: { type: Object, default: null },
});

defineEmits(["close"]);

const vitals = computed(() => props.overview?.vitals ?? []);
const conditions = computed(() => (props.overview?.conditions ?? []).filter((condition) => condition.active));
</script>

<template>
  <div class="modal-backdrop" role="presentation" @click.self="$emit('close')">
    <section
      class="vitals-monitor"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vitals-monitor-title">
      <header>
        <div>
          <p class="label">Real-time vitals</p>
          <h2 id="vitals-monitor-title">Condition monitor</h2>
          <p v-if="clock" class="game-time">{{ formatGameClock(clock) }}</p>
        </div>
        <button type="button" class="sm" @click="$emit('close')">Close</button>
      </header>

      <div class="vitals-grid">
        <article
          v-for="vital in vitals"
          :key="vital.id"
          class="vital-card"
          :class="vital.tone">
          <div class="vital-heading">
            <span>{{ vital.label }}</span>
            <strong>{{ formatVitalValue(vital) }}</strong>
          </div>
          <div
            class="vital-track"
            :aria-label="`${vital.label}: ${formatVitalValue(vital)}`">
            <span
              class="vital-fill"
              :style="{ width: `${Math.round(((vital.value - vital.min) / (vital.max - vital.min || 1)) * 100)}%` }" />
          </div>
          <p v-if="vital.description">{{ vital.description }}</p>
        </article>
      </div>

      <section class="condition-list" aria-label="Active conditions">
        <h3>Conditions</h3>
        <p v-if="!conditions.length" class="empty-note">No active conditions.</p>
        <ul v-else>
          <li
            v-for="condition in conditions"
            :key="condition.id"
            :class="condition.tone">
            {{ condition.label }}: {{ condition.state }}
          </li>
        </ul>
      </section>
    </section>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(8, 11, 16, 0.68);
}
.vitals-monitor {
  width: min(46rem, 100%);
  max-height: min(42rem, calc(100vh - 2rem));
  overflow: auto;
  border: 1px solid #64758d;
  border-radius: 8px;
  background: #1f2630;
  color: #eef3f8;
  padding: 1rem;
  box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.34);
}
header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}
h2,
h3,
p {
  margin: 0;
}
.label {
  color: #9fb0c2;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0;
}
.game-time {
  margin-top: 0.25rem;
  color: #c5cedb;
}
.vitals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}
.vital-card {
  display: grid;
  gap: 0.55rem;
  border: 1px solid #3b4758;
  border-radius: 8px;
  background: #171d26;
  padding: 0.75rem;
}
.vital-card.warning {
  border-color: #8d754d;
}
.vital-card.error {
  border-color: #9b574e;
}
.vital-heading {
  display: grid;
  gap: 0.15rem;
}
.vital-heading span {
  color: #aeb9c8;
  font-size: 0.82rem;
}
.vital-heading strong {
  color: #f2f5f8;
  font-size: 1.05rem;
}
.vital-track {
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: #2d3542;
}
.vital-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #77aa83;
}
.warning .vital-fill {
  background: #d2a94d;
}
.error .vital-fill {
  background: #d56b5d;
}
.vital-card p,
.empty-note {
  color: #aeb8c8;
  font-size: 0.86rem;
  line-height: 1.4;
}
.condition-list {
  margin-top: 1rem;
  border-top: 1px solid #364153;
  padding-top: 0.8rem;
}
.condition-list h3 {
  font-size: 0.95rem;
}
.condition-list ul {
  display: grid;
  gap: 0.4rem;
  padding: 0;
  margin: 0.6rem 0 0;
  list-style: none;
}
.condition-list li {
  border: 1px solid #3b4758;
  border-radius: 7px;
  padding: 0.45rem 0.55rem;
}
.condition-list li.warning {
  border-color: #8d754d;
}
.condition-list li.error {
  border-color: #9b574e;
}
@media (max-width: 640px) {
  header {
    flex-direction: column;
  }
}
</style>
