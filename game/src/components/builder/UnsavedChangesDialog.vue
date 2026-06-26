<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  label: { type: String, default: "Unsaved changes" },
  title: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, default: "" },
  saving: { type: Boolean, default: false },
});

defineEmits(["save", "discard", "keep"]);
</script>

<template>
  <div
    v-if="visible"
    class="unsaved-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="unsaved-title"
  >
    <section class="unsaved-dialog">
      <p class="label">{{ label }}</p>
      <h2 id="unsaved-title">{{ title }}</h2>
      <p>{{ message }}</p>
      <p v-if="status" class="builder-status">{{ status }}</p>
      <div class="unsaved-actions">
        <button type="button" :disabled="saving" @click="$emit('save')">
          {{ saving ? "Saving..." : "Save and continue" }}
        </button>
        <button type="button" class="danger-outline" :disabled="saving" @click="$emit('discard')">
          Discard changes
        </button>
        <button type="button" class="muted" :disabled="saving" @click="$emit('keep')">
          Keep editing
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.unsaved-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(12 18 26 / 0.48);
}

.unsaved-dialog {
  width: min(30rem, 100%);
  padding: 1rem;
  border: 1px solid #d7ded8;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 50px rgb(15 23 42 / 0.24);
}

.label {
  margin: 0 0 0.25rem;
  color: #5f6d62;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
}

p {
  margin: 0 0 0.75rem;
}

.builder-status {
  padding: 0.5rem;
  border-radius: 6px;
  background: #f3f7f4;
  color: #2f4b37;
}

.unsaved-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
