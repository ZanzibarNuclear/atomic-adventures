<template>
  <div v-if="devMode && auditEnabled" class="audit-controls">
    <select v-model="auditState" aria-label="Movement audit state">
      <option value="all">All movement states</option>
      <option v-for="state in auditStates" :key="state" :value="state">
        {{ state }}
      </option>
    </select>
    <span class="audit-summary">
      {{ auditSummary.valid }} valid · {{ auditSummary.blocked }} blocked ·
      {{ auditSummary.invalid }} invalid
    </span>
    <button
      type="button"
      class="audit-close"
      aria-label="Hide movement audit"
      title="Hide movement audit"
      @click="$emit('hide-movement-audit')">
      ×
    </button>
  </div>

  <section class="stage">
    <LocationStageFrame
      :media="locationMedia"
      :mode="locationMediaMode"
      :selected-index="locationMediaIndex"
      :busy="outdoor.traveling"
      @show-map="$emit('show-location-map')"
      @show-image="$emit('show-location-image')"
      @previous-image="$emit('previous-location-image')"
      @next-image="$emit('next-location-image')">
      <HexMap
        :map-data="outdoor.displayMapData"
        :route-models="outdoor.routeModels"
        :feature-models="outdoor.featureModels"
        :current-hex="outdoor.state.currentId"
        :discovered="auditEnabled ? allHexIds : outdoor.discoveredList"
        :discovered-openings="outdoor.state.discoveredOpenings"
        :passage-states="outdoor.passageMarkerStates"
        :flags="outdoor.flags"
        :mode="auditEnabled ? 'full' : outdoor.mode"
        :stand-override="outdoor.standOverride"
        :building-enterable="buildingEnterable"
        :clickable-hex-ids="clickableHexIds"
        :movement-audit-entries="visibleAuditEntries"
        :avatar-instant="auditEnabled"
        @hex-click="travelToAllowedHex"
        @building-enter="enterAllowedBuilding" />
    </LocationStageFrame>
    <MapCaption :title="hexLabel(outdoor.currentHexData)" />
    <p v-if="clock" class="game-timestamp">{{ formatGameTimestamp(clock) }}</p>
  </section>

  <NarrativeCard :beat="narrativeBeat" />

  <StatusLines :lines="statusLines" />

  <PlayPanel>
    <ActionOptions label="Choose an Action">
      <button
        v-for="item in filteredActions"
        :key="item.id"
        class="route-btn"
        :class="[item.kind ? 'k-' + item.kind : null, item.promptCategory ? 'p-' + item.promptCategory : null]"
        :disabled="outdoor.traveling || item.disabled"
        :title="item.hint ?? ''"
        @click="onAction(item.id)">
        {{ item.label }}
      </button>
    </ActionOptions>
  </PlayPanel>
</template>

<script setup>
import { computed, ref } from "vue";
import { hexLabel } from "../../displayLabel.js";
import HexMap from "../components/HexMap.vue";
import LocationStageFrame from "../../../components/game-views/LocationStageFrame.vue";
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import MapCaption from "../components/hud/MapCaption.vue";
import ActionOptions from "../components/hud/ActionOptions.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import NarrativeCard from "../../../components/story/NarrativeCard.vue";
import { formatGameTimestamp } from "../../character/gameTime.js";
import { hexDistance } from "../composables/useHexGeometry.js";
import {
  buildOutdoorPlayActions,
  getMovementOptions,
  buildOutdoorStatusLines,
  handleOutdoorChooseAction,
} from "../../../composables/usePlayPanel.js";
import {
  annotateActionPrompts,
  filterAllowedActions,
  isStoryForwardAction,
  isDestinationAllowed,
} from "../../../composables/storyActionAvailability.js";
import {
  buildMapMovementAudit,
  movementAuditSummary,
} from "../debug/mapMovementAudit.js";

const props = defineProps({
  outdoor: { type: Object, required: true },
  indoor: { type: Object, required: true },
  narrativeBeat: { type: Object, default: null },
  pendingBeat: { type: Object, default: null },
  clock: { type: Object, default: null },
  applyChoice: { type: Function, required: true },
  travelToHex: { type: Function, required: true },
  enterBuilding: { type: Function, required: true },
  auditEnabled: { type: Boolean, default: false },
  actionPolicy: { type: Object, default: null },
  wellbeingOverview: { type: Object, default: null },
  nearbyHoldings: { type: Array, default: () => [] },
  pickupHolding: { type: Function, required: true },
  locationMedia: { type: Object, default: null },
  locationMediaMode: { type: String, default: "map" },
  locationMediaIndex: { type: Number, default: 0 },
});

defineEmits([
  "hide-movement-audit",
  "show-location-map",
  "show-location-image",
  "previous-location-image",
  "next-location-image",
]);

const devMode = import.meta.env.DEV;
const auditState = ref("all");
const allHexIds = computed(() =>
  (props.outdoor.displayMapData.hexes ?? []).map((hex) => hex.id),
);
const auditEntries = computed(() =>
  devMode && props.auditEnabled
    ? buildMapMovementAudit(props.outdoor.displayMapData)
    : [],
);
const auditStates = computed(() => [
  ...new Set(auditEntries.value.map((entry) => entry.stateId)),
]);
const visibleAuditEntries = computed(() =>
  auditState.value === "all"
    ? auditEntries.value
    : auditEntries.value.filter((entry) => entry.stateId === auditState.value),
);
const auditSummary = computed(() =>
  movementAuditSummary(visibleAuditEntries.value),
);

const statusLines = computed(() =>
  buildOutdoorStatusLines(
    props.outdoor,
    props.indoor,
    props.wellbeingOverview,
    props.nearbyHoldings,
  ),
);

const chooseActions = computed(() => {
  // Stand changes within a hex (passage crossings) must refresh travel options.
  void props.outdoor.state?.stand?.x;
  void props.outdoor.state?.stand?.y;
  return getMovementOptions(props.outdoor, props.pendingBeat, {
    suppressEnterBuilding: playActions.value.some((action) => action.id === "enter-building"),
  });
});

const playActions = computed(() => {
  // Barrier searches and passage crossings depend on current stand and barrier hint.
  void props.outdoor.state?.stand?.x;
  void props.outdoor.state?.stand?.y;
  void props.outdoor.state?.discoveredOpenings?.length;
  return buildOutdoorPlayActions(
    props.outdoor,
    props.pendingBeat,
    props.indoor,
    props.nearbyHoldings,
  );
});

const actions = computed(() => [...chooseActions.value, ...playActions.value]);
const allowedActions = computed(() =>
  filterAllowedActions(actions.value, props.actionPolicy),
);
const suggestedActionId = computed(() =>
  suggestedOutdoorStoryActionId(allowedActions.value, props.actionPolicy, props.outdoor),
);
const filteredActions = computed(() =>
  annotateActionPrompts(allowedActions.value, props.actionPolicy)
    .map((action) => action.id === suggestedActionId.value
      ? { ...action, promptCategory: "story" }
      : action)
    .sort(actionSort),
);
const clickableHexIds = computed(() => new Set(
  [...(props.outdoor.reachableHexIds ?? [])].filter((hexId) =>
    isDestinationAllowed(props.actionPolicy, { type: "hex", id: hexId })
  ),
));
const buildingEnterable = computed(() =>
  props.outdoor.atBuildingEntrance &&
  isDestinationAllowed(props.actionPolicy, { type: "transition", id: "building" }),
);

function onAction(id) {
  if (!filteredActions.value.some((action) => action.id === id)) return;
  handleOutdoorChooseAction(
    props.outdoor,
    props.applyChoice,
    id,
    props.travelToHex,
    enterAllowedBuilding,
    props.pickupHolding,
  );
}

function travelToAllowedHex(hexId) {
  if (!isDestinationAllowed(props.actionPolicy, { type: "hex", id: hexId })) return;
  props.travelToHex(hexId);
}

function enterAllowedBuilding() {
  if (!buildingEnterable.value) return;
  props.enterBuilding();
}

function actionSort(a, b) {
  const priority = (action) => action.promptCategory === "story" ? 0 : 1;
  return priority(a) - priority(b);
}

function suggestedOutdoorStoryActionId(actions, policy, outdoor) {
  if (!policy || policy.unrestricted || policy.mode !== "story") return null;
  const explicit = actions.find((action) => isStoryForwardAction(action, policy));
  if (explicit?.id) return explicit.id;

  const targets = storyTargetHexes(policy);
  if (!targets.length) return null;
  const hexById = Object.fromEntries((outdoor.displayMapData?.hexes ?? []).map((hex) => [hex.id, hex]));
  const current = hexById[outdoor.state?.currentId];
  if (!current) return null;
  const candidates = actions.filter((action) => action.toHexId && hexById[action.toHexId]);
  if (!candidates.length) return null;

  const currentDistance = nearestTargetDistance(current, targets, hexById);
  let best = null;
  let bestDistance = Infinity;
  for (const action of candidates) {
    const distance = nearestTargetDistance(hexById[action.toHexId], targets, hexById);
    if (!Number.isFinite(distance)) continue;
    if (distance < bestDistance) {
      best = action;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  return bestDistance <= currentDistance ? best.id : null;
}

function nearestTargetDistance(hex, targets, hexById) {
  return targets.reduce((best, targetId) => {
    const target = hexById[targetId];
    if (!target) return best;
    return Math.min(best, hexDistance(hex, target));
  }, Infinity);
}

function storyTargetHexes(policy) {
  const allowed = policy?.allowed ?? {};
  const hexes = new Set(Array.isArray(allowed.movement?.hexes) ? allowed.movement.hexes : []);
  for (const id of allowed.storyForwardActions ?? []) {
    if (typeof id !== "string") continue;
    if (id.startsWith("move-hex:")) hexes.add(id.slice("move-hex:".length));
    if (id.startsWith("route:") || id.startsWith("barrier:")) hexes.add(id.slice(id.indexOf(":") + 1));
  }
  return [...hexes];
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
.audit-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(104, 227, 145, 0.35);
  border-radius: 8px;
  background: rgba(21, 35, 26, 0.78);
}
.audit-controls select {
  padding: 0.35rem 0.55rem;
  border: 1px solid rgba(207, 231, 211, 0.32);
  border-radius: 6px;
  background: #24362a;
  color: #eef7ef;
}
.audit-summary {
  color: #cbe7d0;
  font-size: 0.82rem;
}
.audit-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: #ff6b6b;
  padding: 0.05rem 0.35rem;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
}
.audit-close:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.12);
  color: #ff8b8b;
}
</style>
