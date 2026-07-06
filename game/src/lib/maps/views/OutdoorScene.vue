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
    <MapCaption :title="hexLabel(outdoor.currentHexData)" />
    <p v-if="clock" class="game-timestamp">{{ formatGameTimestamp(clock) }}</p>
    <VitalsAlertBar :alerts="wellbeingAlerts" />
  </section>

  <NarrativeCard :beat="narrativeBeat" />

  <StatusLines :lines="statusLines" />

  <PlayPanel v-if="filteredActions.length">
    <ActionOptions label="Choose an Action">
      <button
        v-for="item in filteredActions"
        :key="item.id"
        class="route-btn"
        :class="item.kind ? 'k-' + item.kind : null"
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
import PlayPanel from "../../../components/hud/PlayPanel.vue";
import MapCaption from "../components/hud/MapCaption.vue";
import ActionOptions from "../components/hud/ActionOptions.vue";
import StatusLines from "../../../components/hud/StatusLines.vue";
import NarrativeCard from "../../../components/story/NarrativeCard.vue";
import VitalsAlertBar from "../../../components/game-views/VitalsAlertBar.vue";
import { formatGameTimestamp } from "../../character/gameTime.js";
import {
  buildOutdoorPlayActions,
  getMovementOptions,
  buildOutdoorStatusLines,
  handleOutdoorChooseAction,
} from "../../../composables/usePlayPanel.js";
import {
  annotateActionPrompts,
  filterAllowedActions,
  isDestinationAllowed,
} from "../../../composables/useStoryline.js";
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
  wellbeingAlerts: { type: Array, default: () => [] },
});

defineEmits(["hide-movement-audit"]);

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
  buildOutdoorStatusLines(props.outdoor, props.indoor),
);

const chooseActions = computed(() => {
  // Stand changes within a hex (passage crossings) must refresh travel options.
  void props.outdoor.state?.stand?.x;
  void props.outdoor.state?.stand?.y;
  return getMovementOptions(props.outdoor, props.pendingBeat);
});

const playActions = computed(() => {
  // Barrier searches and passage crossings depend on current stand and barrier hint.
  void props.outdoor.state?.stand?.x;
  void props.outdoor.state?.stand?.y;
  void props.outdoor.state?.discoveredOpenings?.length;
  return buildOutdoorPlayActions(props.outdoor, props.pendingBeat);
});

const actions = computed(() => [...chooseActions.value, ...playActions.value]);
const filteredActions = computed(() =>
  annotateActionPrompts(filterAllowedActions(actions.value, props.actionPolicy), props.actionPolicy),
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
