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
  <div class="floating-layer" role="presentation">
    <section
      class="vitals-monitor"
      role="dialog"
      aria-modal="false"
      aria-labelledby="vitals-monitor-title">
      <header>
        <div>
          <p class="label">Real-time vitals</p>
          <h2 id="vitals-monitor-title">Condition monitor</h2>
          <p v-if="clock" class="game-time">{{ formatGameClock(clock) }}</p>
          <div class="vitals-strip" aria-label="Vitals summary">
            <span
              v-for="vital in vitals"
              :key="vital.id"
              class="strip-meter"
              :class="vital.tone"
              :title="`${vital.label}: ${formatVitalValue(vital)}`">
              <span>{{ vital.label }}</span>
              <b>
                <i
                  :style="{ width: `${Math.round(((vital.value - vital.min) / (vital.max - vital.min || 1)) * 100)}%` }" />
              </b>
            </span>
          </div>
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
.floating-layer {
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 50;
  width: min(38rem, calc(100vw - 1.5rem));
  pointer-events: none;
}
.vitals-monitor {
  width: 100%;
  max-height: min(38rem, calc(100vh - 1.5rem));
  overflow: auto;
  border: 1px solid #64758d;
  border-radius: 8px;
  background: #1f2630;
  color: #eef3f8;
  padding: 1rem;
  box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.34);
  pointer-events: auto;
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
.vitals-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(3.6rem, 1fr));
  gap: 0.35rem;
  margin-top: 0.55rem;
}
.strip-meter {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.strip-meter span {
  overflow: hidden;
  color: #aeb9c8;
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.strip-meter b {
  display: block;
  height: 0.38rem;
  border-radius: 999px;
  background: #2d3542;
  overflow: hidden;
}
.strip-meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #77aa83;
}
.strip-meter.warning i {
  background: #d2a94d;
}
.strip-meter.error i {
  background: #d56b5d;
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
  .floating-layer {
    top: 0.5rem;
    right: 0.5rem;
    width: calc(100vw - 1rem);
  }
  header {
    flex-direction: column;
  }
  .vitals-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
