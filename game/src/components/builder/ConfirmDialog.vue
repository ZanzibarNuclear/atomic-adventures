<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  eyebrow: { type: String, default: "Confirm" },
  title: { type: String, required: true },
  message: { type: String, default: "" },
  confirmLabel: { type: String, default: "Confirm" },
  cancelLabel: { type: String, default: "Cancel" },
  danger: { type: Boolean, default: true },
});

defineEmits(["confirm", "cancel"]);
</script>

<template>
  <div
    v-if="visible"
    class="confirm-backdrop"
    role="presentation"
    @click.self="$emit('cancel')"
  >
    <section
      class="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <p class="confirm-eyebrow" :class="{ danger }">{{ eyebrow }}</p>
      <h2 id="confirm-dialog-title">{{ title }}</h2>
      <p v-if="message" class="confirm-message">{{ message }}</p>
      <div class="confirm-actions">
        <button
          type="button"
          class="sm"
          :class="danger ? 'danger' : 'success-btn'"
          @click="$emit('confirm')"
        >
          <svg
            v-if="danger"
            class="btn-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M8 7l.8 12.2A1.5 1.5 0 0 0 10.3 20.5h3.4a1.5 1.5 0 0 0 1.5-1.3L16 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linejoin="round"
            />
          </svg>
          {{ confirmLabel }}
        </button>
        <button type="button" class="sm muted" @click="$emit('cancel')">
          {{ cancelLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(8 12 18 / 0.55);
  backdrop-filter: blur(2px);
}

.confirm-dialog {
  width: min(28rem, 100%);
  padding: 1.1rem 1.15rem;
  border: 1px solid #4a5568;
  border-radius: 10px;
  background: #1b212b;
  color: #e8edf5;
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.4);
}

.confirm-eyebrow {
  margin: 0 0 0.3rem;
  color: #9fc7ff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.confirm-eyebrow.danger {
  color: #ffb4b4;
}

.confirm-dialog h2 {
  margin: 0 0 0.55rem;
  font-size: 1.15rem;
  color: #f4f7fb;
}

.confirm-message {
  margin: 0 0 1rem;
  color: #b7c0cc;
  line-height: 1.45;
  white-space: pre-line;
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
