<template>
  <section class="stage">
    <LocationStageFrame
      :media="locationMedia"
      :mode="locationMediaMode"
      :selected-index="locationMediaIndex"
      :busy="indoor.indoor.moving"
      @show-map="$emit('show-location-map')"
      @show-image="$emit('show-location-image')"
      @previous-image="$emit('previous-location-image')"
      @next-image="$emit('next-location-image')">
      <IndoorMapStage v-bind="mapStageProps" v-on="mapStageListeners" />
    </LocationStageFrame>
    <MapCaption :title="locationTitle" />
    <p v-if="clock" class="game-timestamp">{{ formatGameTimestamp(clock) }}</p>
  </section>

  <NarrativeCard :beat="narrativeBeat" />

  <IndoorMovementAudit
    v-if="auditEnabled && devMode"
    :indoor="indoor"
    @close="$emit('hide-movement-audit')"
  />

  <StatusLines :lines="statusLines" />

  <PlayPanel>
    <ActionOptions label="Choose an Action">
      <button
        v-for="item in filteredActions"
        :key="item.id"
        class="route-btn"
        :class="item.kind ? 'k-' + item.kind : null"
        :disabled="indoor.indoor.moving || item.disabled"
        :title="item.hint ?? ''"
        @click="onAction(item.id)">
        {{ item.label }}
      </button>
    </ActionOptions>
  </PlayPanel>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from "vue";
import { displayLabel, roomLabel } from "../../displayLabel.js";
import IndoorMapStage from "../components/IndoorMapStage.vue";
import LocationStageFrame from "../../../components/game-views/LocationStageFrame.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import MapCaption from "../components/hud/MapCaption.vue";
import ActionOptions from "../components/hud/ActionOptions.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import NarrativeCard from "../../../components/story/NarrativeCard.vue";
import IndoorMovementAudit from "../components/diagnostics/IndoorMovementAudit.vue";
import { formatGameTimestamp } from "../../character/gameTime.js";
import {
  buildIndoorChooseActions,
  buildIndoorPlayActions,
  buildIndoorStatusLines,
  formatNearbyReachableItemsMessage,
  handleIndoorChooseAction,
  handleIndoorPlayAction,
  nearbyReachableItemsSignature,
} from "../../../composables/usePlayPanel.js";
import {
  clearPlayMessages,
  pushPlayMessage,
} from "../../../composables/usePlayMessages.js";
import {
  filterAllowedActions,
  isActionAllowed,
  isDestinationAllowed,
} from "../../../composables/storyActionAvailability.js";

const props = defineProps({
  indoor: { type: Object, required: true },
  narrativeBeat: { type: Object, default: null },
  pendingBeat: { type: Object, default: null },
  clock: { type: Object, default: null },
  applyChoice: { type: Function, required: true },
  travelToRoom: { type: Function, required: true },
  auditEnabled: { type: Boolean, default: false },
  extraActions: { type: Array, default: () => [] },
  actionPolicy: { type: Object, default: null },
  wellbeingOverview: { type: Object, default: null },
  locationMedia: { type: Object, default: null },
  locationMediaMode: { type: String, default: "map" },
  locationMediaIndex: { type: Number, default: 0 },
});

const emit = defineEmits([
  "hide-movement-audit",
  "extra-action",
  "stage-view",
  "look-in-holding",
  "inspect-container-group",
  "show-location-map",
  "show-location-image",
  "previous-location-image",
  "next-location-image",
]);
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

watch(
  () => props.indoor.indoor?.currentRoom ?? null,
  () => {
    clearPlayMessages("action");
  },
);

watch(
  () => nearbyReachableItemsSignature(props.indoor),
  () => {
    clearPlayMessages("nearby-items");
    const message = formatNearbyReachableItemsMessage(props.indoor);
    if (message) {
      pushPlayMessage(message, { source: "nearby-items", tone: "notice" });
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearPlayMessages("action");
  clearPlayMessages("nearby-items");
});

const statusLines = computed(() =>
  buildIndoorStatusLines(props.indoor, props.wellbeingOverview),
);

const playActions = computed(() =>
  buildIndoorPlayActions(props.indoor, props.pendingBeat),
);

const actions = computed(() => [
  ...chooseActions.value,
  ...props.extraActions,
  ...playActions.value,
]);
const filteredActions = computed(() =>
  filterAllowedActions(actions.value, props.actionPolicy),
);

function publishActionNotice(result) {
  clearPlayMessages("action");
  if (result?.notice) {
    pushPlayMessage(result.notice, { source: "action", tone: "notice" });
  }
}

function onAction(id) {
  if (!filteredActions.value.some((action) => action.id === id)) return;
  if (props.extraActions.some((action) => action.id === id)) {
    emit("extra-action", id);
    return;
  }
  if (id.startsWith("story:")) {
    clearPlayMessages("action");
    handleIndoorChooseAction(
      props.indoor,
      props.applyChoice,
      id,
      props.travelToRoom,
    );
    return;
  }
  const result = handleIndoorPlayAction(props.indoor, id);
  publishActionNotice(result);
  if (result?.view) emit("stage-view", result.view);
  if (result?.lookIn) emit("look-in-holding", result.lookIn);
  if (result?.inspectGroup) emit("inspect-container-group", result.inspectGroup);
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
  reachableRooms: (props.indoor.reachableRooms ?? []).filter((roomId) =>
    isDestinationAllowed(props.actionPolicy, { type: "room", id: roomId })
  ),
  reachableExteriorNodes: (props.indoor.reachableExteriorNodes ?? []).filter((nodeId) =>
    isDestinationAllowed(props.actionPolicy, { type: "exteriorNode", id: nodeId })
  ),
  doorStates: props.indoor.indoor.doorState,
  interactableDoorIds: (props.indoor.interactableDoorIds ?? []).filter((doorId) =>
    isDoorActionAllowed(doorId)
  ),
  reachableExitDoors: (props.indoor.reachableExitDoors ?? []).filter((doorId) =>
    isActionAllowed(`exit-world:${doorId}`, props.actionPolicy)
  ),
  hydroDiscovered: props.indoor.hydroDiscovered ?? false,
}));

const mapStageListeners = computed(() => ({
  "room-click": (roomId) => {
    if (isDestinationAllowed(props.actionPolicy, { type: "room", id: roomId })) props.travelToRoom(roomId);
  },
  "stand-click": ({ roomId, standId }) => {
    if (
      roomId === props.indoor.indoor.currentRoom &&
      isActionAllowed(`move-stand:${standId}`, props.actionPolicy)
    ) {
      props.indoor.moveToStand(standId);
    }
  },
  "exterior-node-click": (nodeId) => {
    if (isDestinationAllowed(props.actionPolicy, { type: "exteriorNode", id: nodeId })) {
      props.indoor.moveToExteriorNode(nodeId);
    }
  },
  "door-click": (doorId) => {
    if (isDoorActionAllowed(doorId)) props.indoor.tryToggleDoor(doorId);
  },
  "exit-click": (doorId) => {
    if (isActionAllowed(`exit-world:${doorId}`, props.actionPolicy)) props.indoor.exitViaDoor(doorId);
  },
}));

function isDoorActionAllowed(doorId) {
  return isActionAllowed(`door-open:${doorId}`, props.actionPolicy) ||
    isActionAllowed(`door-close:${doorId}`, props.actionPolicy) ||
    isActionAllowed(`door-lock:${doorId}`, props.actionPolicy) ||
    isActionAllowed(`door-break:${doorId}`, props.actionPolicy);
}
</script>

<style scoped>
.stage {
  display: block;
  margin-bottom: 0.65rem;
}
.game-timestamp {
  margin: 0.35rem 0 0;
  color: #9fb0c2;
  font-size: 0.78rem;
  letter-spacing: 0;
  opacity: 0.82;
  text-align: right;
}
</style>
