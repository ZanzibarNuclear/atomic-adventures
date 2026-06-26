<script setup>
defineProps({
  selected: { type: Object, required: true },
  routeKinds: { type: Array, required: true },
});
</script>

<template>
  <label>Kind
    <select v-model="selected.kind">
      <option v-for="kind in routeKinds" :key="kind">{{ kind }}</option>
    </select>
  </label>
  <label>Label<input v-model="selected.label" /></label>
  <label class="check-field"><input v-model="selected.smooth" type="checkbox" /> Smooth line</label>
</template>
