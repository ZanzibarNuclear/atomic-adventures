<template>
  <Teleport to="body">
    <div
      class="vitals-modal-backdrop"
      role="presentation"
      @click.self="$emit('close')">
      <section
        class="vitals-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vitals-dialog-title">
        <header class="vitals-dialog-header">
          <h2 id="vitals-dialog-title">Health</h2>
          <button
            type="button"
            class="vitals-close"
            aria-label="Close vitals"
            title="Close"
            @click="$emit('close')">
            ×
          </button>
        </header>

        <section
          v-if="vitals.length"
          class="vital-list"
          aria-label="Current vital ranges">
          <article v-for="vital in vitals" :key="vital.id" class="vital-row">
            <div class="vital-value">
              <span class="vital-label">{{ vital.label }}</span>
              <output class="vital-badge" :class="vital.tone">{{
                formatValue(vital.value)
              }}</output>
            </div>

            <div class="vital-range">
              <div
                class="vital-track"
                :class="vital.tone"
                role="progressbar"
                :aria-label="`${vital.label}: ${formatValue(vital.value)} of ${formatValue(vital.min)} to ${formatValue(vital.max)}, ${vital.state}`"
                :aria-valuemin="rangeMin(vital)"
                :aria-valuemax="rangeMax(vital)"
                :aria-valuenow="rangeValue(vital)"
                :aria-valuetext="vital.state">
                <span
                  class="vital-fill"
                  :style="{ width: `${rangePercentage(vital)}%` }"></span>
              </div>
              <div class="vital-range-labels">
                <span>{{ formatValue(vital.min) }}</span>
                <strong :class="vital.tone">{{ vital.state }}</strong>
                <span>{{ formatValue(vital.max) }}</span>
              </div>
            </div>
          </article>
        </section>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  vitals: { type: Array, default: () => [] },
});

defineEmits(["close"]);

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function rangeMin(vital) {
  return numberOr(vital.min, 0);
}

function rangeMax(vital) {
  return Math.max(rangeMin(vital), numberOr(vital.max, 100));
}

function rangeValue(vital) {
  return Math.min(
    rangeMax(vital),
    Math.max(rangeMin(vital), numberOr(vital.value, rangeMin(vital))),
  );
}

function rangePercentage(vital) {
  const span = rangeMax(vital) - rangeMin(vital);
  if (span <= 0) return 100;
  return ((rangeValue(vital) - rangeMin(vital)) / span) * 100;
}

function formatValue(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    numberOr(value, 0),
  );
}
</script>

<style scoped>
.vitals-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.68);
}
.vitals-dialog {
  width: min(100%, 34rem);
  border: 1px solid #756143;
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  padding: 0.85rem;
  color: #f4ead7;
}
.vitals-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.65rem;
}
.vitals-dialog-header h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0;
}
.vitals-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: #f4ead7;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}
.vitals-close:hover,
.vitals-close:focus-visible {
  color: #ffe3aa;
}
.vital-list {
  display: grid;
  gap: 0.85rem;
}
.vital-row {
  display: grid;
  grid-template-columns: minmax(6.75rem, auto) minmax(0, 1fr);
  align-items: center;
  gap: 0.85rem;
}
.vital-value {
  display: grid;
  justify-items: start;
  gap: 0.3rem;
}
.vital-label {
  color: #c9c0ad;
  font-size: 0.82rem;
}
.vital-badge {
  min-width: 3.25rem;
  padding: 0.22rem 0.5rem;
  border: 1px solid #55705b;
  border-radius: 999px;
  background: #14321d;
  color: #a8f0b2;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
}
.vital-badge.warning {
  border-color: #a45f25;
  background: #3e2112;
  color: #ffbc7a;
}
.vital-badge.error {
  border-color: #9a3e3e;
  background: #3d1717;
  color: #ff9a9a;
}
.vital-range {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
.vital-track {
  height: 0.7rem;
  overflow: hidden;
  border: 1px solid rgba(168, 240, 178, 0.26);
  border-radius: 999px;
  background: rgba(10, 16, 22, 0.7);
}
.vital-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4e9c5d, #a8f0b2);
  transition: width 0.2s ease;
}
.vital-track.warning {
  border-color: rgba(255, 188, 122, 0.35);
}
.vital-track.warning .vital-fill {
  background: linear-gradient(90deg, #a45f25, #ffbc7a);
}
.vital-track.error {
  border-color: rgba(255, 154, 154, 0.35);
}
.vital-track.error .vital-fill {
  background: linear-gradient(90deg, #9a3e3e, #ff9a9a);
}
.vital-range-labels {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.45rem;
  color: #a69f91;
  font-size: 0.76rem;
}
.vital-range-labels strong {
  color: #a8f0b2;
  font-weight: 600;
  text-align: center;
}
.vital-range-labels strong.warning {
  color: #ffbc7a;
}
.vital-range-labels strong.error {
  color: #ff9a9a;
}
@media (max-width: 420px) {
  .vital-row {
    grid-template-columns: minmax(5.25rem, auto) minmax(0, 1fr);
    gap: 0.65rem;
  }
}
</style>
