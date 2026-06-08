<template>
  <div class="builder-actions">
    <label
      v-if="showSmooth"
      class="mode-pill sm"
      :class="{ active: smooth }">
      <input type="checkbox" :checked="smooth" @change="$emit('toggle-smooth')" />
      smooth curve
    </label>
    <label v-if="addPointLabel" class="mode-pill sm" :class="{ active: addPointMode }">
      <input
        type="checkbox"
        :checked="addPointMode"
        @change="$emit('update:addPointMode', $event.target.checked)" />
      {{ addPointLabel }}
    </label>
    <label v-if="addNodeLabel" class="mode-pill sm" :class="{ active: addNodeMode }">
      <input
        type="checkbox"
        :checked="addNodeMode"
        @change="$emit('update:addNodeMode', $event.target.checked)" />
      {{ addNodeLabel }}
    </label>
    <p v-if="addPointHint && addPointMode" class="builder-inline-hint">
      {{ addPointHint }}
    </p>
    <p v-else-if="addNodeHint && addNodeMode" class="builder-inline-hint">
      {{ addNodeHint }}
    </p>
    <button
      v-if="deletePointLabel"
      class="sm"
      :disabled="!canDeletePoint"
      @click="$emit('delete-point')">
      {{ deletePointLabel }}
    </button>
    <button
      v-if="deleteNodeLabel"
      class="sm"
      :disabled="!canDeleteNode"
      @click="$emit('delete-node')">
      {{ deleteNodeLabel }}
    </button>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  showSmooth: { type: Boolean, default: true },
  smooth: { type: Boolean, default: false },
  addPointMode: { type: Boolean, default: false },
  addPointLabel: { type: String, default: "" },
  addPointHint: { type: String, default: "" },
  addNodeMode: { type: Boolean, default: false },
  addNodeLabel: { type: String, default: "" },
  addNodeHint: { type: String, default: "" },
  deletePointLabel: { type: String, default: "" },
  canDeletePoint: { type: Boolean, default: false },
  deleteNodeLabel: { type: String, default: "" },
  canDeleteNode: { type: Boolean, default: false },
});

defineEmits([
  "toggle-smooth",
  "update:addPointMode",
  "update:addNodeMode",
  "delete-point",
  "delete-node",
]);
</script>

<style scoped>
.builder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}
.builder-inline-hint {
  margin: 0.35rem 0 0;
  color: #f4a261;
  font-size: 0.78rem;
  line-height: 1.4;
  width: 100%;
}
</style>
