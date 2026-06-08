<template>
  <div v-if="door.kind === 'man'" class="builder-props">
    <label class="prop-row">
      <span>X</span>
      <input
        type="number"
        step="0.05"
        :value="door.at?.x"
        @input="$emit('update-at', Number($event.target.value), door.at?.y ?? 0)" />
    </label>
    <label class="prop-row">
      <span>Y</span>
      <input
        type="number"
        step="0.05"
        :value="door.at?.y"
        @input="$emit('update-at', door.at?.x ?? 0, Number($event.target.value))" />
    </label>
    <label class="prop-row checkbox">
      <input
        type="checkbox"
        :checked="door.vertical"
        @change="$emit('update-vertical', $event.target.checked)" />
      vertical
    </label>
    <p class="prop-readonly">ID: {{ doorId }}</p>
  </div>

  <div v-else-if="door.kind === 'roll'" class="builder-props">
    <p class="prop-readonly">Room: {{ door.room }}</p>
    <label class="prop-row">
      <span>Edge</span>
      <select
        :value="rollDoorRoom?.rollDoor ?? 'right'"
        @change="$emit('update-roll', { edge: $event.target.value })">
        <option value="top">top</option>
        <option value="bottom">bottom</option>
        <option value="left">left</option>
        <option value="right">right</option>
      </select>
    </label>
    <label class="prop-row">
      <span>Span</span>
      <input
        type="range"
        min="0.1"
        max="1"
        step="0.01"
        :value="rollDoorRoom?.rollSpan ?? 0.6"
        @input="$emit('update-roll', { rollSpan: Number($event.target.value) })" />
      <span class="prop-value">{{
        (rollDoorRoom?.rollSpan ?? 0.6).toFixed(2)
      }}</span>
    </label>
    <p class="prop-readonly">ID: {{ doorId }}</p>
  </div>
</template>

<script setup>
defineProps({
  door: { type: Object, required: true },
  doorId: { type: String, required: true },
  rollDoorRoom: { type: Object, default: null },
});

defineEmits(["update-at", "update-vertical", "update-roll"]);
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
.prop-row.checkbox {
  grid-template-columns: auto 1fr;
}
.prop-row input[type="number"],
.prop-row select {
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
.prop-value {
  font-size: 0.78rem;
  color: #9aa0ac;
}
</style>
