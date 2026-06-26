<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import OutdoorWorldBuilderView from "./OutdoorWorldBuilderView.vue";
import UtilityStationBuilderView from "./UtilityStationBuilderView.vue";

const route = useRoute();
const router = useRouter();

const workspace = computed(() =>
  route.query.map === "utility-station" ? "utility-station" : "outdoors",
);

function selectWorkspace(next) {
  if (next === workspace.value) return;
  const query = { ...route.query };
  if (next === "utility-station") query.map = "utility-station";
  else delete query.map;
  void router.push({ path: route.path, query });
}
</script>

<template>
  <section class="world-builder-shell">
    <nav class="world-map-tabs" aria-label="World map workspace">
      <button
        type="button"
        :class="{ active: workspace === 'outdoors' }"
        @click="selectWorkspace('outdoors')"
      >
        Outdoor
      </button>
      <button
        type="button"
        :class="{ active: workspace === 'utility-station' }"
        @click="selectWorkspace('utility-station')"
      >
        Utility Station
      </button>
    </nav>

    <OutdoorWorldBuilderView v-if="workspace === 'outdoors'" />
    <UtilityStationBuilderView v-else />
  </section>
</template>

<style scoped>
.world-builder-shell {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4.25rem);
  min-height: 0;
  overflow: hidden;
}
.world-builder-shell :deep(.world-builder),
.world-builder-shell :deep(.station-builder) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.world-map-tabs {
  display: flex;
  gap: .35rem;
  padding: .65rem .85rem 0;
}
.world-map-tabs button {
  padding: .45rem .9rem;
  border: 1px solid #3c4658;
  border-radius: 8px;
  background: #171b22;
  color: #aeb5c0;
}
.world-map-tabs button.active {
  border-color: #6f9b79;
  background: #49624f;
  color: #eef7f0;
}
</style>
