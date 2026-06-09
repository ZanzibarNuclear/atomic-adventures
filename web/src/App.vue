<script setup>
import { ref } from "vue";
import mapData from "../content/world/map.yaml";
import buildingData from "../content/world/utility-station.yaml";
import { useOutdoorWorld } from "./composables/useOutdoorWorld.js";
import { useHexMapBuilder } from "./composables/useHexMapBuilder.js";
import { useIndoorBuilding } from "./composables/useIndoorBuilding.js";
import { useGridMapBuilder } from "./composables/useGridMapBuilder.js";
import AppHeader from "./components/AppHeader.vue";
import OutdoorScene from "./views/OutdoorScene.vue";
import IndoorScene from "./views/IndoorScene.vue";

const place = ref("outdoors");
const builderView = ref(false);
const expanded = ref(false);

const outdoor = useOutdoorWorld(mapData);
const hexBuilder = useHexMapBuilder(outdoor, builderView);

const ctx = { place, builderView };
const indoor = useIndoorBuilding(buildingData, outdoor, ctx);
const gridBuilder = useGridMapBuilder(indoor, { builderView, place });

function reset() {
  outdoor.resetPlayer();
  place.value = "outdoors";
  indoor.resetIndoor();
}
</script>

<template>
  <main>
    <AppHeader />

    <OutdoorScene
      v-if="place === 'outdoors'"
      :outdoor="outdoor"
      :hex-builder="hexBuilder"
      :indoor="indoor"
      :builder-view="builderView"
      :expanded="expanded"
      @reset="reset"
      @update:expanded="expanded = $event"
      @update:builder-view="builderView = $event" />

    <IndoorScene
      v-else
      :indoor="indoor"
      :grid-builder="gridBuilder"
      :builder-view="builderView"
      :expanded="expanded"
      @update:expanded="expanded = $event"
      @update:builder-view="builderView = $event" />
  </main>
</template>

<style scoped>
main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
</style>
