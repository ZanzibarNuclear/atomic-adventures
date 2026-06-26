<script setup>
import InventoryBrowser from "./InventoryBrowser.vue";

defineProps({
  holders: { type: Array, required: true },
  selectedHolding: { type: Object, default: null },
  selectedHoldingId: { type: String, default: null },
  transferTargets: { type: Array, required: true },
  publicAssetPath: { type: Function, required: true },
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
      <button type="button" class="sm" @click="$emit('return-to-map')">Return to map</button>
    </header>
    <InventoryBrowser
      :holders="holders"
      :selected-holding="selectedHolding"
      :selected-holding-id="selectedHoldingId"
      :transfer-targets="transferTargets"
      :public-asset-path="publicAssetPath"
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
  border: 1px solid #2f3540;
  border-radius: 8px;
  background: #20242d;
}
.stage-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}
.stage-header h2 {
  margin: 0.1rem 0 0;
  font-size: 1.15rem;
}
@media (max-width: 640px) {
  .stage-header {
    flex-direction: column;
  }
}
</style>
