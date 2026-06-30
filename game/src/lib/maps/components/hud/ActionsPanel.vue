<template>
  <div v-if="actions.length" class="actions">
    <span class="label">{{ label }}</span>
    <div v-for="action in actions" :key="action.id" class="action-row">
      <button class="sm" @click="$emit('action', action.id)">
        {{ actionButtonLabel(action) }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  actions: { type: Array, default: () => [] },
  label: { type: String, default: "Actions" },
});

defineEmits(["action"]);

function actionButtonLabel(action) {
  if (action.verb) return `${action.verb} ${withArticle(action.label)}`;
  return action.label;
}

function withArticle(label) {
  if (!label) return "";
  return /^(the|a|an)\s/i.test(label) ? label : `the ${label}`;
}
</script>

<style scoped>
.actions {
  margin-top: 0.75rem;
}
.action-row {
  margin-top: 0.35rem;
}
</style>
