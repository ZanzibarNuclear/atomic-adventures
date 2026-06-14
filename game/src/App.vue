<script setup>
import { ref } from "vue";
import mapData from "../content/world/map.yaml";
import buildingData from "../content/world/utility-station.yaml";
import { useOutdoorWorld } from "./lib/maps/composables/useOutdoorWorld.js";
import { useIndoorBuilding } from "./lib/maps/composables/useIndoorBuilding.js";
import AppHeader from "./components/AppHeader.vue";
import OutdoorScene from "./lib/maps/views/OutdoorScene.vue";
import IndoorScene from "./lib/maps/views/IndoorScene.vue";

const place = ref("outdoors");
const builderView = ref(false);
const expanded = ref(false);

const outdoor = useOutdoorWorld(mapData);
const ctx = { place, builderView };
const indoor = useIndoorBuilding(buildingData, outdoor, ctx);

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
      :indoor="indoor"
      :expanded="expanded"
      @reset="reset"
      @update:expanded="expanded = $event" />

    <IndoorScene
      v-else
      :indoor="indoor"
      :expanded="expanded"
      @update:expanded="expanded = $event" />
  </main>
</template>

<style scoped>
main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
</style>
