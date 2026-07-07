<script setup>
import InventoryBrowser from "./InventoryBrowser.vue";

defineProps({
  holders: { type: Array, required: true },
  selectedHolding: { type: Object, default: null },
  selectedHoldingId: { type: String, default: null },
  transferTargets: { type: Array, required: true },
  publicAssetPath: { type: Function, required: true },
  actionPolicy: { type: Object, default: null },
  actionFeedback: { type: String, default: "" },
});

defineEmits(["select-holding", "transfer-item", "use-item", "return-to-map"]);
</script>

<template>
  <section class="stage inspection-stage" aria-labelledby="inventory-stage-title">
    <header class="stage-header">
      <div>
        <p class="label">Inventory</p>
        <h2 id="inventory-stage-title">Inspect carried items</h2>
      </div>
      <button type="button" class="sm" @click="$emit('return-to-map')">Return</button>
    </header>
    <InventoryBrowser
      :holders="holders"
      :selected-holding="selectedHolding"
      :selected-holding-id="selectedHoldingId"
      :transfer-targets="transferTargets"
      :public-asset-path="publicAssetPath"
      :action-policy="actionPolicy"
      :action-feedback="actionFeedback"
      @select-holding="$emit('select-holding', $event)"
      @transfer-item="$emit('transfer-item', $event)"
      @use-item="$emit('use-item', $event)" />
  </section>
</template>

<style scoped>
.inspection-stage {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid rgba(120, 150, 195, 0.28);
  border-radius: 10px;
  background: radial-gradient(circle at 50% 25%, #2a3548, #151a24);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.45);
  color: #e8edf5;
}
.stage-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}
.stage-header .label {
  color: #8faed6;
}
.stage-header h2 {
  margin: 0.1rem 0 0;
  font-size: 1.15rem;
  color: #eef3fb;
}
@media (max-width: 640px) {
  .stage-header {
    flex-direction: column;
  }
}
</style>
