<template>
  <!-- Stage boundary: isolates GridMap prop/event surface from the scene HUD. -->
  <GridMap v-bind="attrs" />
</template>

<script setup>
import { useAttrs } from "vue";
import GridMap from "./GridMap.vue";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
</script>
