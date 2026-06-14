<template>
  <div class="location">
    <span class="label">{{ label }}</span>
    <strong>{{ title }}</strong>
    <em v-if="blurb">{{ blurb }}</em>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, default: "Location" },
  title: { type: String, required: true },
  blurb: { type: String, default: "" },
});
</script>

<style scoped>
.location {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.location strong {
  font-size: 1.1rem;
}
.location em {
  color: #9aa0ac;
  font-size: 0.88rem;
}
</style>
