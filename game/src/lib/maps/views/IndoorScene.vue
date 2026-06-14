<template>
  <section class="stage">
    <IndoorMapStage v-bind="mapStageProps" v-on="mapStageListeners" />
    <MapCaption :title="locationTitle" />
  </section>

  <NarrativeCard
    :beat="narrativeBeat"
    @choose="$emit('narrative-choose', $event)" />

  <PlayPanel>
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
import { displayLabel, roomLabel } from "../../displayLabel.js";
import IndoorMapStage from "../components/IndoorMapStage.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import MapCaption from "../components/hud/MapCaption.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import InventoryPanel from "../components/hud/InventoryPanel.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import PlayActions from "../../../components/hud/PlayActions.vue";
import NarrativeCard from "../../../components/story/NarrativeCard.vue";
import {
  buildIndoorPlayActions,
  buildIndoorStatusLines,
  handleIndoorPlayAction,
} from "../../../composables/usePlayPanel.js";

const props = defineProps({
  indoor: { type: Object, required: true },
  narrativeBeat: { type: Object, default: null },
});

defineEmits(["narrative-choose"]);

const locationTitle = computed(() => {
  const { indoor } = props;
  if (indoor.currentExteriorNode) {
    return displayLabel(indoor.currentExteriorNode);
  }
  return roomLabel(indoor.currentRoomData);
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
  margin-bottom: 1rem;
}
</style>
