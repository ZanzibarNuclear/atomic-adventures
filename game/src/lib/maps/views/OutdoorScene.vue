<template>
  <section class="stage">
    <HexMap
      :map-data="outdoor.displayMapData"
      :route-models="outdoor.routeModels"
      :feature-models="outdoor.featureModels"
      :current-hex="outdoor.state.currentId"
      :discovered="outdoor.discoveredList"
      :mode="outdoor.mode"
      :stand-override="outdoor.standOverride"
      :avatar-instant="!!outdoor.state.barrierStand"
      @hex-click="outdoor.moveTo"
      @building-enter="indoor.enterBuilding" />
  </section>

  <PlayPanel>
    <LocationBlock
      :title="
        outdoor.currentHexData.landmark?.name ?? outdoor.currentHexData.id
      "
      :blurb="outdoor.currentHexData.landmark?.blurb ?? ''" />

    <StatusLines :lines="statusLines" />

    <TravelOptions label="Follow a route">
      <button
        v-for="m in outdoor.moves"
        :key="m.routeId + m.toHexId"
        class="route-btn"
        :class="'k-' + m.kind"
        :disabled="outdoor.traveling"
        @click="outdoor.moveTo(m.toHexId)">
        Take {{ m.routeName }} {{ m.label }}
        <span class="dest">→ {{ outdoor.nameOf(m.toHexId) }}</span>
      </button>
      <button
        v-for="o in outdoor.offRoad"
        :key="'off-' + o.toHexId"
        class="route-btn off"
        :disabled="outdoor.traveling"
        @click="outdoor.moveTo(o.toHexId)">
        Go off-road {{ o.label }}
        <span v-if="o.blockedBy" class="barrier-hint">· {{ o.blockedBy }}</span>
        <span class="dest">→ ?</span>
      </button>
    </TravelOptions>

    <PlayActions
      v-if="playActions.length"
      :items="playActions"
      @select="onPlayAction" />
  </PlayPanel>
</template>

<script setup>
import { computed } from "vue";
import HexMap from "../components/HexMap.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import LocationBlock from "../components/hud/LocationBlock.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import PlayActions from "../../../components/hud/PlayActions.vue";
import {
  buildOutdoorStatusLines,
} from "../../../composables/usePlayPanel.js";

const props = defineProps({
  outdoor: { type: Object, required: true },
  indoor: { type: Object, required: true },
});

const statusLines = computed(() =>
  buildOutdoorStatusLines(props.outdoor, props.indoor),
);

const playActions = computed(() => {
  if (!props.outdoor.atBuildingEntrance) return [];
  return [
    {
      id: "enter-building",
      label: `Enter the ${props.indoor.building.name}`,
    },
  ];
});

function onPlayAction(id) {
  if (id === "enter-building") props.indoor.enterBuilding();
}
</script>

<style scoped>
.stage {
  display: block;
  margin-bottom: 1.5rem;
}
.barrier-hint {
  color: #a89878;
  font-size: 0.85em;
  text-transform: capitalize;
}
</style>
