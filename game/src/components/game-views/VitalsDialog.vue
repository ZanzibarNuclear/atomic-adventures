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
          <h2 id="vitals-dialog-title">Vitals</h2>
          <button
            type="button"
            class="vitals-close"
            aria-label="Close vitals"
            title="Close"
            @click="$emit('close')">
            ×
          </button>
        </header>

        <VitalsAlertBar :alerts="alerts" />
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import VitalsAlertBar from "./VitalsAlertBar.vue";

defineProps({
  alerts: { type: Array, default: () => [] },
});

defineEmits(["close"]);
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
  width: min(32rem, 100%);
  border: 1px solid #756143;
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  padding: 1rem;
  color: #f4ead7;
}
.vitals-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.vitals-dialog-header h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: 0;
}
.vitals-close {
  width: 2rem;
  height: 2rem;
  border: 1px solid #756143;
  border-radius: 999px;
  background: #252016;
  color: #f4ead7;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}
.vitals-close:hover,
.vitals-close:focus-visible {
  border-color: #d7b77f;
  color: #ffe3aa;
}
</style>
