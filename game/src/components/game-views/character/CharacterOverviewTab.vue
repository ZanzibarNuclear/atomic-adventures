<script setup>
import { computed } from "vue";
import { characterWellbeingOverview } from "../../../lib/character/panel.js";

const props = defineProps({
  character: { type: Object, required: true },
});

const wellbeing = computed(() => characterWellbeingOverview(props.character));
</script>

<template>
  <div class="overview-grid">
    <section class="panel-card">
      <h3>Health</h3>
      <dl class="stat-list">
        <div v-for="vital in wellbeing.vitals" :key="vital.id">
          <dt>{{ vital.label }}</dt>
          <dd>
            <span class="measure-detail" :class="vital.tone">
              <meter :min="vital.min" :max="vital.max" :value="vital.value">
                {{ vital.state }}
              </meter>
              <span>{{ vital.state }}</span>
            </span>
          </dd>
        </div>
      </dl>
      <h3 class="section-heading">Conditions</h3>
      <ul class="condition-list">
        <li
          v-for="condition in wellbeing.conditions"
          :key="condition.id"
          :class="{ active: condition.active }">
          <span>{{ condition.label }}</span>
          <span class="condition-state" :class="condition.tone">
            <strong>{{ condition.state }}</strong>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
}
.panel-card {
  padding: 1rem;
  border: 1px solid #394454;
  border-radius: 10px;
  background: rgba(24, 29, 37, 0.72);
}
h3 {
  margin: 0;
}
.section-heading {
  margin-top: 1.15rem;
}
.stat-list {
  display: grid;
  gap: 0.7rem;
  margin: 1rem 0 0;
}
.stat-list div,
.condition-list li {
  display: grid;
  grid-template-columns: minmax(6.5rem, 0.6fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.55rem;
}
.stat-list dt,
.condition-list span,
.empty-state {
  color: #8f98a6;
}
.stat-list dd {
  min-width: 0;
  margin: 0;
}
.measure-detail {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(6.5rem, max-content);
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.measure-detail > span,
.measure-detail strong {
  text-align: right;
}
.measure-detail.positive > span,
.condition-state.positive strong {
  color: #9fdbad;
}
.measure-detail.warning > span,
.condition-state.warning strong {
  color: #ffb38a;
}
.measure-detail.error > span,
.condition-state.error strong {
  color: #ff8a8a;
}
.stat-list meter {
  width: 100%;
  min-width: 0;
}
.condition-list span {
  min-width: 0;
}
.condition-list {
  display: grid;
  gap: 0.55rem;
  padding: 0;
  margin: 0.75rem 0 0;
  list-style: none;
}
.condition-list strong {
  font-weight: 600;
  text-align: left;
}
@media (max-width: 520px) {
  .stat-list div,
  .condition-list li {
    grid-template-columns: minmax(5.4rem, 0.5fr) minmax(0, 1fr);
    gap: 0.45rem;
  }
  .measure-detail {
    grid-template-columns: minmax(4.75rem, 1fr) minmax(5.25rem, max-content);
    gap: 0.5rem;
  }
}
</style>
