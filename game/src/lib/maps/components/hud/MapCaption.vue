<template>
  <p class="map-caption">{{ title }}</p>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
});
</script>

<style scoped>
.map-caption {
  margin: 0.5rem 0 0;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  color: #e8eaed;
  line-height: 1.3;
}
</style>
