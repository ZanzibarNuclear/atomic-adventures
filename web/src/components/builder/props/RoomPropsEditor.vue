<template>
  <div class="builder-props">
    <label class="prop-row">
      <span>Name</span>
      <input
        type="text"
        :value="room.name ?? ''"
        @input="$emit('update-name', $event.target.value)" />
    </label>
    <label class="prop-row">
      <span>X</span>
      <input
        type="number"
        step="0.5"
        :value="room.x"
        @input="$emit('update-rect', { x: Number($event.target.value) })" />
    </label>
    <label class="prop-row">
      <span>Y</span>
      <input
        type="number"
        step="0.5"
        :value="room.y"
        @input="$emit('update-rect', { y: Number($event.target.value) })" />
    </label>
    <label class="prop-row">
      <span>W</span>
      <input
        type="number"
        step="0.5"
        min="0.5"
        :value="room.w"
        @input="$emit('update-rect', { w: Number($event.target.value) })" />
    </label>
    <label class="prop-row">
      <span>H</span>
      <input
        type="number"
        step="0.5"
        min="0.5"
        :value="room.h"
        @input="$emit('update-rect', { h: Number($event.target.value) })" />
    </label>
    <p class="prop-readonly">ID: {{ roomId }}</p>
  </div>
</template>

<script setup>
defineProps({
  room: { type: Object, required: true },
  roomId: { type: String, required: true },
});

defineEmits(["update-name", "update-rect"]);
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
