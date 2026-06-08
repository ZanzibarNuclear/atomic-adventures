<template>
  <div class="builder-export">
    <span class="label">Export</span>
    <div class="export-btns">
      <button
        v-for="btn in buttons"
        :key="btn.key"
        class="sm"
        :class="{ muted: btn.muted }"
        @click="$emit('action', btn.key)">
        {{ btn.label }}
      </button>
    </div>
    <p v-if="status" class="export-status">{{ status }}</p>
  </div>
</template>

<script setup>
defineProps({
  buttons: { type: Array, required: true },
  status: { type: String, default: "" },
});

defineEmits(["action"]);
</script>

<style scoped>
.builder-export {
  display: grid;
  gap: 0.4rem;
}
.export-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.export-status {
  margin: 0;
  color: #7dcea0;
  font-size: 0.82rem;
}
</style>
