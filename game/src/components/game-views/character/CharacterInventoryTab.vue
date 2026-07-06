<script setup>
import InventoryBrowser from "../InventoryBrowser.vue";

defineProps({
  holders: { type: Array, required: true },
  selectedHolding: { type: Object, default: null },
  selectedHoldingId: { type: String, default: null },
  transferTargets: { type: Array, required: true },
  publicAssetPath: { type: Function, required: true },
  actionPolicy: { type: Object, default: null },
});

defineEmits(["select-holding", "transfer-item", "use-item"]);
</script>

<template>
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
</template>
