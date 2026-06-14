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
    <MapCaption :title="hexLabel(outdoor.currentHexData)" />
  </section>

  <NarrativeCard
    :beat="narrativeBeat"
    @choose="$emit('narrative-choose', $event)" />

  <PlayPanel>
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
import { hexLabel } from "../../displayLabel.js";
import HexMap from "../components/HexMap.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import MapCaption from "../components/hud/MapCaption.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import PlayActions from "../../../components/hud/PlayActions.vue";
import NarrativeCard from "../../../components/story/NarrativeCard.vue";
import {
  buildOutdoorStatusLines,
} from "../../../composables/usePlayPanel.js";

const props = defineProps({
  outdoor: { type: Object, required: true },
  indoor: { type: Object, required: true },
  narrativeBeat: { type: Object, default: null },
});

defineEmits(["narrative-choose"]);

const statusLines = computed(() =>
  buildOutdoorStatusLines(props.outdoor, props.indoor),
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

function onPlayAction(id) {
  if (id === "enter-building") props.indoor.enterBuilding();
}
</script>

<style scoped>
.stage {
  display: block;
  margin-bottom: 1rem;
}
.barrier-hint {
  color: #a89878;
  font-size: 0.85em;
  text-transform: capitalize;
}
</style>
