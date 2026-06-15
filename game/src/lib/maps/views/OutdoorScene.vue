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
      @hex-click="travelToHex"
      @building-enter="enterBuilding" />
    <MapCaption :title="hexLabel(outdoor.currentHexData)" />
  </section>

  <NarrativeCard :beat="narrativeBeat" />

  <PlayPanel>
    <StatusLines :lines="statusLines" />

    <TravelOptions v-if="chooseActions.length" label="Choose an Action">
      <button
        v-for="item in chooseActions"
        :key="item.id"
        class="route-btn"
        :class="item.kind ? 'k-' + item.kind : 'k-story'"
        :disabled="outdoor.traveling"
        :title="item.hint ?? ''"
        @click="onChooseAction(item.id)">
        {{ item.label }}
      </button>
    </TravelOptions>

    <PlayActions
      v-if="playActions.length"
      :items="playActions"
      label="Actions"
      @select="onPlayAction" />
  </PlayPanel>
</template>

<script setup>
import { computed } from "vue";
import { hexLabel } from "../../displayLabel.js";
import HexMap from "../components/HexMap.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import MapCaption from "../components/hud/MapCaption.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import PlayActions from "../../../components/hud/PlayActions.vue";
import NarrativeCard from "../../../components/story/NarrativeCard.vue";
import {
  getMovementOptions,
  buildOutdoorStatusLines,
  handleOutdoorChooseAction,
} from "../../../composables/usePlayPanel.js";

const props = defineProps({
  outdoor: { type: Object, required: true },
  indoor: { type: Object, required: true },
  narrativeBeat: { type: Object, default: null },
  pendingBeat: { type: Object, default: null },
  applyChoice: { type: Function, required: true },
  travelToHex: { type: Function, required: true },
  enterBuilding: { type: Function, required: true },
});

const statusLines = computed(() =>
  buildOutdoorStatusLines(props.outdoor, props.indoor),
);

const chooseActions = computed(() =>
  getMovementOptions(props.outdoor, props.pendingBeat),
);

const playActions = computed(() => {
  if (!props.outdoor.atBuildingEntrance) return [];
  return [
    {
      id: "enter-building",
      label: `Enter the ${props.indoor.building.label}`,
    },
  ];
});

function onChooseAction(id) {
  handleOutdoorChooseAction(
    props.outdoor,
    props.applyChoice,
    id,
    props.travelToHex,
  );
}

function onPlayAction(id) {
  if (id === "enter-building") props.enterBuilding();
}
</script>

<style scoped>
.stage {
  display: block;
  margin-bottom: 1rem;
}
</style>
