<template>
  <div v-if="pickups.length" class="pickups">
    <span class="label">Found here</span>
    <div v-for="p in pickups" :key="p.id" class="pickup-row">
      <button class="sm" @click="$emit('pickup', p.id)">
        Take — {{ p.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  pickups: { type: Array, default: () => [] },
});

defineEmits(["pickup"]);
</script>

<style scoped>
.pickups {
  margin-top: 0.75rem;
}
.pickup-row {
  margin-top: 0.35rem;
}
</style>
