<script setup>
import { computed } from "vue";

const props = defineProps({
  selection: { type: Object, required: true },
});

const isWall = computed(() => props.selection.source === "walls");
</script>

<template>
  <section class="form-section">
    <div class="section-heading">
      <h4>Identity</h4>
      <code>{{ selection.id }}</code>
    </div>
    <p class="read-only-note">
      This visual-only object can be selected and edited on the map, but does not affect traversal.
    </p>
    <label>Kind<input :value="isWall ? 'stone wall' : selection.entity.kind" disabled /></label>
    <label v-if="selection.entity.visualOnly">Role<input value="Visual only" disabled /></label>
  </section>

  <section class="form-section">
    <div class="section-heading">
      <h4>Scope</h4>
    </div>
    <label v-if="!isWall">Connects<input :value="(selection.entity.connects ?? []).join(', ')" disabled /></label>
    <label>Levels<input :value="(selection.entity.onLevels ?? []).join(', ')" disabled /></label>
  </section>
</template>

<style scoped>
.read-only-note { color: #aeb5c0; font-size: .78rem; line-height: 1.45; }
</style>
