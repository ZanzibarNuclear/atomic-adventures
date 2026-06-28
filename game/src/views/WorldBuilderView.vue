<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import BuilderWorkspaceTabs from "../components/builder/BuilderWorkspaceTabs.vue";
import OutdoorWorldBuilderView from "./OutdoorWorldBuilderView.vue";
import UtilityStationBuilderView from "./UtilityStationBuilderView.vue";

const route = useRoute();
const router = useRouter();

const workspace = computed(() =>
  route.query.map === "utility-station" ? "utility-station" : "outdoors",
);
const worldWorkspaceTabs = [
  { id: "outdoors", label: "Area" },
  { id: "utility-station", label: "Utility Station" },
];

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
    <OutdoorWorldBuilderView v-if="workspace === 'outdoors'">
      <template #workspace-switcher>
        <BuilderWorkspaceTabs
          aria-label="World map workspace"
          :items="worldWorkspaceTabs"
          :active-id="workspace"
          @select="selectWorkspace"
        />
      </template>
    </OutdoorWorldBuilderView>
    <UtilityStationBuilderView v-else>
      <template #workspace-switcher>
        <BuilderWorkspaceTabs
          aria-label="World map workspace"
          :items="worldWorkspaceTabs"
          :active-id="workspace"
          @select="selectWorkspace"
        />
      </template>
    </UtilityStationBuilderView>
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
</style>
