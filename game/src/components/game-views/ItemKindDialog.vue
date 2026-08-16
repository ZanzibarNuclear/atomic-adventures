<template>
  <Teleport to="body">
    <div
      class="kind-modal-backdrop"
      role="presentation"
      @click.self="$emit('close')">
      <section
        class="kind-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kind-dialog-title">
        <header class="kind-dialog-header">
          <div>
            <p class="label">{{ eyebrow }}</p>
            <h2 id="kind-dialog-title">{{ title }}</h2>
          </div>
          <button
            type="button"
            class="kind-close"
            aria-label="Close"
            title="Close"
            @click="$emit('close')">
            ×
          </button>
        </header>

        <div v-if="item" class="kind-body">
          <div v-if="item.icon" class="kind-image">
            <img :src="publicAssetPath(item.icon)" :alt="item.label">
          </div>
          <p class="kind-description">
            {{ item.description || "No description has been authored." }}
          </p>
          <p v-if="remainingLabel" class="kind-meta">{{ remainingLabel }}</p>
        </div>
        <p v-else class="empty-state">The box is empty.</p>

        <footer class="kind-actions">
          <button type="button" class="sm" @click="$emit('close')">Close</button>
          <button
            v-if="item && canTake"
            type="button"
            class="sm brand"
            @click="$emit('take-one')">
            Take one
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  eyebrow: { type: String, default: "Tastee Tack" },
  title: { type: String, required: true },
  item: { type: Object, default: null },
  publicAssetPath: { type: Function, required: true },
});

defineEmits(["close", "take-one"]);

const canTake = computed(() => Number(props.item?.quantity) > 0);

const remainingLabel = computed(() => {
  const quantity = Number(props.item?.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return "";
  if (quantity === 1) return "1 meal left in this box.";
  return `${quantity} meals left in this box.`;
});
</script>

<style scoped>
.kind-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.68);
}
.kind-dialog {
  width: min(32rem, 100%);
  max-height: min(38rem, calc(100vh - 2rem));
  overflow: auto;
  border: 1px solid rgba(120, 150, 195, 0.34);
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  padding: 1rem;
  color: #e8edf5;
}
.kind-dialog-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.kind-dialog-header .label {
  margin: 0;
  color: #8faed6;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.kind-dialog-header h2 {
  margin: 0.15rem 0 0;
  font-size: 1.12rem;
}
.kind-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: transparent;
  color: #e8edf5;
  font-size: 1.25rem;
  cursor: pointer;
}
.kind-body {
  display: grid;
  gap: 0.75rem;
}
.kind-image {
  display: grid;
  place-items: center;
  min-height: 10rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(28, 36, 52, 0.82);
}
.kind-image img {
  max-width: 100%;
  max-height: 14rem;
  object-fit: contain;
}
.kind-description {
  margin: 0;
  color: #d5deea;
  font-size: 0.95rem;
  line-height: 1.5;
}
.kind-meta {
  margin: 0;
  color: #93a3bc;
  font-size: 0.82rem;
}
.empty-state {
  margin: 0;
  color: #93a3bc;
}
.kind-actions {
  display: flex;
  justify-content: end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
