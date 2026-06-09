<template>
  <div class="builder-props">
    <p class="prop-readonly">
      {{ exit.door ? `Door: ${exit.door}` : `Transition: ${exit.id}` }} · anchor {{ exit.at?.x }}, {{ exit.at?.y }}
    </p>
    <label class="prop-row">
      <span>Map X</span>
      <input
        type="number"
        step="0.05"
        :value="mapAt.x"
        @input="$emit('update-map-at', Number($event.target.value), mapAt.y)" />
    </label>
    <label class="prop-row">
      <span>Map Y</span>
      <input
        type="number"
        step="0.05"
        :value="mapAt.y"
        @input="$emit('update-map-at', mapAt.x, Number($event.target.value))" />
    </label>
    <button v-if="exit.mapAt" class="sm muted" @click="$emit('reset-map-at')">
      Reset to default offset
    </button>
  </div>
</template>

<script setup>
defineProps({
  exit: { type: Object, required: true },
  mapAt: { type: Object, required: true },
});

defineEmits(["update-map-at", "reset-map-at"]);
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
