<template>
  <section class="stage">
    <IndoorMapStage v-bind="mapStageProps" v-on="mapStageListeners" />
  </section>

  <PlayPanel>
    <LocationBlock
      :label="indoor.building.name"
      :title="locationTitle"
      :blurb="locationBlurb" />

    <StatusLines :lines="statusLines" />

    <TravelOptions label="Move">
      <button
        v-for="m in indoor.indoorMoves"
        :key="indoor.moveKey(m)"
        class="route-btn"
        :class="
          'k-' +
          (m.kind === 'door' ? 'path' : m.kind === 'path' ? 'trail' : 'road')
        "
        :disabled="indoor.indoor.moving"
        @click="indoor.applyIndoorMove(m)">
        Go {{ m.label }}
        <span class="dest"
          >→
          {{
            m.toExteriorNode
              ? m.toName
              : m.onSpiral ||
                  indoor.isDestinationNamed(m.toRoomId, indoor.indoorVisibility)
                ? m.toName
                : "?"
          }}</span
        >
      </button>
    </TravelOptions>

    <InventoryPanel :items="indoor.carriedItems" />

    <PlayActions
      v-if="playActions.length"
      :items="playActions"
      @select="onPlayAction" />
  </PlayPanel>
</template>

<script setup>
import { computed } from "vue";
import IndoorMapStage from "../components/IndoorMapStage.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import LocationBlock from "../components/hud/LocationBlock.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import InventoryPanel from "../components/hud/InventoryPanel.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import PlayActions from "../../../components/hud/PlayActions.vue";
import {
  buildIndoorPlayActions,
  buildIndoorStatusLines,
  handleIndoorPlayAction,
} from "../../../composables/usePlayPanel.js";

const props = defineProps({
  indoor: { type: Object, required: true },
});

const locationTitle = computed(
  () =>
    props.indoor.currentExteriorNode?.label ??
    props.indoor.currentRoomData?.name ??
    props.indoor.currentRoomData?.id ??
    "",
);

const locationBlurb = computed(() => {
  if (props.indoor.currentRoomData?.blurb) {
    return props.indoor.currentRoomData.blurb;
  }
  if (props.indoor.currentExteriorNode) {
    return "Outside on the footpath.";
  }
  return "";
});

const statusLines = computed(() => buildIndoorStatusLines(props.indoor));

const playActions = computed(() => buildIndoorPlayActions(props.indoor));

function onPlayAction(id) {
  handleIndoorPlayAction(props.indoor, id);
}

const mapStageProps = computed(() => ({
  building: props.indoor.building,
  currentRoom: props.indoor.indoor.currentRoom ?? "",
  exteriorNode: props.indoor.indoor.exteriorNode,
  avatarWaypoint: props.indoor.indoor.avatarWaypoint,
  discovered: [...props.indoor.indoor.discovered],
  revealed: [...props.indoor.indoor.revealed],
  level: props.indoor.indoor.viewLevel,
  standLevel: props.indoor.indoor.level,
  reachableRooms: props.indoor.reachableRooms,
  reachableExteriorNodes: props.indoor.reachableExteriorNodes,
  doorStates: props.indoor.indoor.doorState,
  interactableDoorIds: props.indoor.interactableDoorIds,
  reachableExitDoors: props.indoor.reachableExitDoors,
  hydroDiscovered: props.indoor.hydroDiscovered ?? false,
}));

const mapStageListeners = computed(() => ({
  "room-click": props.indoor.moveToRoom,
  "exterior-node-click": props.indoor.moveToExteriorNode,
  "door-click": props.indoor.tryToggleDoor,
  "exit-click": props.indoor.exitViaDoor,
}));
</script>

<style scoped>
.stage {
  display: block;
  margin-bottom: 1.5rem;
}
</style>
