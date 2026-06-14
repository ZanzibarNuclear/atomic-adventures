<template>
  <div class="modes">
    <span v-if="groupLabel" class="label">{{ groupLabel }}</span>
    <template v-if="options.length">
      <label
        v-for="opt in options"
        :key="opt.value"
        class="mode-pill"
        :class="{ active: modelValue === opt.value, sm: small }">
        <input
          type="radio"
          :value="opt.value"
          :checked="modelValue === opt.value"
          @change="$emit('update:modelValue', opt.value)" />
        {{ opt.label }}
      </label>
    </template>
    <label
      v-if="checkbox"
      class="mode-pill builder-pill"
      :class="{ active: checkboxValue, sm: small }">
      <input
        type="checkbox"
        :checked="checkboxValue"
        @change="$emit('update:checkboxValue', $event.target.checked)" />
      {{ checkbox.label }}
    </label>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  groupLabel: { type: String, default: "" },
  modelValue: { type: String, default: "" },
  options: { type: Array, default: () => [] },
  checkbox: { type: Object, default: null },
  checkboxValue: { type: Boolean, default: false },
  small: { type: Boolean, default: false },
});

defineEmits(["update:modelValue", "update:checkboxValue"]);
</script>

<style scoped>
.modes {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
