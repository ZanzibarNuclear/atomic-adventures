<script setup>
defineProps({
  selection: { type: Object, required: true },
});
</script>

<template>
  <p class="read-only-note">
    Fixture geometry is currently read-only. Its room connections and level placement
    are validated on save.
  </p>
  <label>Kind<input :value="selection.entity.kind" disabled /></label>
  <label>Connects<input :value="(selection.entity.connects ?? []).join(', ')" disabled /></label>
  <label>Levels<input :value="(selection.entity.onLevels ?? []).join(', ')" disabled /></label>
</template>

<style scoped>
.read-only-note { color: #aeb5c0; font-size: .78rem; line-height: 1.45; }
</style>
