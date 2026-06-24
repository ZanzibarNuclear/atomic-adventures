<template>
  <section class="stage">
    <IndoorMapStage v-bind="mapStageProps" v-on="mapStageListeners" />
    <MapCaption :title="locationTitle" />
  </section>

  <NarrativeCard :beat="narrativeBeat" />

  <IndoorMovementAudit
    v-if="auditEnabled && devMode"
    :indoor="indoor"
    @close="$emit('hide-movement-audit')"
  />

  <PlayPanel>
    <StatusLines :lines="statusLines" />

    <TravelOptions v-if="actions.length" label="Choose an Action">
      <button
        v-for="item in actions"
        :key="item.id"
        class="route-btn"
        :class="item.kind ? 'k-' + item.kind : 'k-story'"
        :disabled="indoor.indoor.moving || item.disabled"
        :title="item.hint ?? ''"
        @click="onAction(item.id)">
        {{ item.label }}
      </button>
    </TravelOptions>
  </PlayPanel>
</template>

<script setup>
import { computed } from "vue";
import { displayLabel, roomLabel } from "../../displayLabel.js";
import IndoorMapStage from "../components/IndoorMapStage.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import MapCaption from "../components/hud/MapCaption.vue";
import TravelOptions from "../components/hud/TravelOptions.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import NarrativeCard from "../../../components/story/NarrativeCard.vue";
import IndoorMovementAudit from "../components/diagnostics/IndoorMovementAudit.vue";
import {
  buildIndoorChooseActions,
  buildIndoorPlayActions,
  buildIndoorStatusLines,
  handleIndoorChooseAction,
  handleIndoorPlayAction,
} from "../../../composables/usePlayPanel.js";

const props = defineProps({
  indoor: { type: Object, required: true },
  narrativeBeat: { type: Object, default: null },
  pendingBeat: { type: Object, default: null },
  applyChoice: { type: Function, required: true },
  travelToRoom: { type: Function, required: true },
  auditEnabled: { type: Boolean, default: false },
});

defineEmits(["hide-movement-audit"]);
const devMode = import.meta.env.DEV;

const locationTitle = computed(() => {
  const { indoor } = props;
  if (indoor.currentExteriorNode) {
    return displayLabel(indoor.currentExteriorNode);
  }
  return roomLabel(indoor.currentRoomData);
});

const chooseActions = computed(() =>
  buildIndoorChooseActions(props.indoor, props.pendingBeat),
);

const statusLines = computed(() => buildIndoorStatusLines(props.indoor));

const playActions = computed(() =>
  buildIndoorPlayActions(props.indoor, props.pendingBeat),
);

const actions = computed(() => [...chooseActions.value, ...playActions.value]);

function onAction(id) {
  if (id.startsWith("story:")) {
    handleIndoorChooseAction(
      props.indoor,
      props.applyChoice,
      id,
      props.travelToRoom,
    );
    return;
  }
  handleIndoorPlayAction(props.indoor, id);
}

const mapStageProps = computed(() => ({
  building: props.indoor.building,
  currentRoom: props.indoor.indoor.currentRoom ?? "",
  currentStand: props.indoor.indoor.currentStand,
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
  "room-click": props.travelToRoom,
  "stand-click": ({ roomId, standId }) => {
    if (roomId === props.indoor.indoor.currentRoom) props.indoor.moveToStand(standId);
  },
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
