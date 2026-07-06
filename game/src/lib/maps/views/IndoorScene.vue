<template>
  <section class="stage">
    <IndoorMapStage v-bind="mapStageProps" v-on="mapStageListeners" />
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

  <PlayPanel v-if="filteredActions.length">
    <ActionOptions v-if="storyForwardActions.length" label="Story Forward">
      <button
        v-for="item in storyForwardActions"
        :key="item.id"
        class="route-btn"
        :class="[item.kind ? 'k-' + item.kind : null, 'story-forward-action']"
        :disabled="indoor.indoor.moving || item.disabled"
        :title="item.hint ?? ''"
        @click="onAction(item.id)">
        {{ item.label }}
      </button>
    </ActionOptions>
    <ActionOptions v-if="otherActions.length" label="Choose an Action">
      <button
        v-for="item in otherActions"
        :key="item.id"
        class="route-btn"
        :class="[item.kind ? 'k-' + item.kind : null, item.promptCategory === 'optional' ? 'optional-action' : null]"
        :disabled="indoor.indoor.moving || item.disabled"
        :title="item.hint ?? ''"
        @click="onAction(item.id)">
        {{ item.label }}
      </button>
    </ActionOptions>
  </PlayPanel>
</template>

<script setup>
import { computed } from "vue";
import { displayLabel, roomLabel } from "../../displayLabel.js";
import IndoorMapStage from "../components/IndoorMapStage.vue";
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
  handleIndoorChooseAction,
  handleIndoorPlayAction,
} from "../../../composables/usePlayPanel.js";
import {
  annotateActionPrompts,
  filterAllowedActions,
  isActionAllowed,
  isDestinationAllowed,
} from "../../../composables/useStoryline.js";

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
});

const emit = defineEmits(["hide-movement-audit", "extra-action", "stage-view"]);
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

const actions = computed(() => [
  ...chooseActions.value,
  ...props.extraActions,
  ...playActions.value,
]);
const filteredActions = computed(() =>
  annotateActionPrompts(filterAllowedActions(actions.value, props.actionPolicy), props.actionPolicy),
);
const storyForwardActions = computed(() =>
  filteredActions.value.filter((action) => action.promptCategory === "story-forward"),
);
const otherActions = computed(() =>
  filteredActions.value.filter((action) => action.promptCategory !== "story-forward"),
);

function onAction(id) {
  if (!filteredActions.value.some((action) => action.id === id)) return;
  if (props.extraActions.some((action) => action.id === id)) {
    emit("extra-action", id);
    return;
  }
  if (id.startsWith("story:")) {
    handleIndoorChooseAction(
      props.indoor,
      props.applyChoice,
      id,
      props.travelToRoom,
    );
    return;
  }
  const result = handleIndoorPlayAction(props.indoor, id);
  if (result?.view) emit("stage-view", result.view);
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
  margin-bottom: 1rem;
}
.game-timestamp {
  margin: 0.35rem 0 0;
  color: #9fb0c2;
  font-size: 0.78rem;
  letter-spacing: 0;
  opacity: 0.82;
  text-align: right;
}
.story-forward-action {
  border-color: rgba(139, 196, 154, 0.7);
  background: rgba(83, 125, 94, 0.24);
}
.optional-action {
  opacity: 0.92;
}
</style>
