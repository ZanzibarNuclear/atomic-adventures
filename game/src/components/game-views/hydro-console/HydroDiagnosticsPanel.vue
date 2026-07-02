<script setup>
defineProps({
  diagnostics: { type: Array, required: true },
  guidedActions: { type: Array, required: true },
});

defineEmits(["return-to-map"]);
</script>

<template>
  <div class="diagnostics-panel">
    <h2>Diagnostics</h2>
    <p v-if="!diagnostics.length" class="quiet">No warnings or faults.</p>
    <ul v-else>
      <li v-for="item in diagnostics" :key="`${item.kind}:${item.id}`">
        <strong>{{ item.kind }}</strong>
        <span>{{ item.label }}</span>
      </li>
    </ul>
    <div v-if="guidedActions.length" class="guided-actions">
      <h3>Next field action</h3>
      <div v-for="action in guidedActions" :key="action.id" class="guided-action">
        <strong>{{ action.title }}</strong>
        <span>{{ action.body }}</span>
        <button type="button" @click="$emit('return-to-map')">Return to map</button>
      </div>
    </div>
  </div>
</template>
