<template>
  <Teleport to="body">
    <div
      class="inventory-modal-backdrop"
      role="presentation"
      @click.self="$emit('close')">
      <section
        class="inventory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-dialog-title">
        <header class="inventory-dialog-header">
          <div>
            <p class="label">Inventory</p>
            <h2 id="inventory-dialog-title">Carried items</h2>
          </div>
          <button
            type="button"
            class="inventory-close"
            aria-label="Close inventory"
            title="Close"
            @click="$emit('close')">
            ×
          </button>
        </header>

        <InventoryBrowser
          :holders="holders"
          :selected-holding="selectedHolding"
          :selected-holding-id="selectedHoldingId"
          :transfer-targets="transferTargets"
          :public-asset-path="publicAssetPath"
          :action-policy="actionPolicy"
          @select-holding="$emit('select-holding', $event)"
          @transfer-item="$emit('transfer-item', $event)"
          @use-item="$emit('use-item', $event)" />
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import InventoryBrowser from "./InventoryBrowser.vue";

defineProps({
  holders: { type: Array, required: true },
  selectedHolding: { type: Object, default: null },
  selectedHoldingId: { type: String, default: null },
  transferTargets: { type: Array, required: true },
  publicAssetPath: { type: Function, required: true },
  actionPolicy: { type: Object, default: null },
});

defineEmits(["close", "select-holding", "transfer-item", "use-item"]);
</script>

<style scoped>
.inventory-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 9, 12, 0.68);
}
.inventory-dialog {
  width: min(58rem, 100%);
  max-height: min(46rem, calc(100vh - 2rem));
  overflow: auto;
  border: 1px solid rgba(120, 150, 195, 0.34);
  border-radius: 8px;
  background: #171b22;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
  padding: 1rem;
  color: #e8edf5;
}
.inventory-dialog-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.inventory-dialog-header .label {
  margin: 0;
  color: #8faed6;
}
.inventory-dialog-header h2 {
  margin: 0.1rem 0 0;
  font-size: 1.15rem;
  letter-spacing: 0;
}
.inventory-close {
  width: 2rem;
  height: 2rem;
  border: 1px solid rgba(120, 150, 195, 0.42);
  border-radius: 999px;
  background: #20283a;
  color: #e8edf5;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}
.inventory-close:hover,
.inventory-close:focus-visible {
  border-color: #8faed6;
  color: #ffffff;
}
@media (max-width: 760px) {
  .inventory-dialog :deep(.inventory-layout) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
