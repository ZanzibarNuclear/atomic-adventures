<template>
  <div class="builder-props">
    <label class="prop-row">
      <span>Label</span>
      <input
        type="text"
        :value="node.label ?? ''"
        @input="$emit('update-label', $event.target.value)" />
    </label>
    <label class="prop-row">
      <span>X</span>
      <input
        type="number"
        step="0.05"
        :value="node.at?.x"
        @input="$emit('update-at', Number($event.target.value), node.at?.y ?? 0)" />
    </label>
    <label class="prop-row">
      <span>Y</span>
      <input
        type="number"
        step="0.05"
        :value="node.at?.y"
        @input="$emit('update-at', node.at?.x ?? 0, Number($event.target.value))" />
    </label>
    <p class="prop-readonly">ID: {{ nodeId }}</p>
  </div>
</template>

<script setup>
defineProps({
  node: { type: Object, required: true },
  nodeId: { type: String, required: true },
});

defineEmits(["update-label", "update-at"]);
</script>

<style scoped>
.builder-props {
  display: grid;
  gap: 0.45rem;
}
.prop-row {
  display: grid;
  grid-template-columns: 3.5rem 1fr;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.85rem;
  color: #c5cad3;
}
.prop-row input[type="text"],
.prop-row input[type="number"] {
  background: #2f3a4d;
  color: #e8eaed;
  border: 1px solid #3f4c63;
  border-radius: 4px;
  padding: 0.3rem 0.45rem;
  font-size: 0.85rem;
}
.prop-readonly {
  margin: 0;
  font-size: 0.78rem;
  color: #6f7787;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
</style>
