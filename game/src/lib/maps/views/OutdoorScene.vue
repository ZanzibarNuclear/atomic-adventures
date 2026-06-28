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
      :building-enterable="outdoor.atBuildingEntrance"
      :clickable-hex-ids="outdoor.reachableHexIds"
      :movement-audit-entries="visibleAuditEntries"
      :avatar-instant="auditEnabled"
      @hex-click="travelToHex"
      @building-enter="enterBuilding" />
    <MapCaption :title="hexLabel(outdoor.currentHexData)" />
  </section>

  <NarrativeCard :beat="narrativeBeat" />

  <StatusLines :lines="statusLines" />

  <PlayPanel v-if="actions.length">
    <ActionOptions v-if="actions.length" label="Choose an Action">
      <button
        v-for="item in actions"
        :key="item.id"
        class="route-btn"
        :class="item.kind ? 'k-' + item.kind : 'k-story'"
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
import {
  buildOutdoorPlayActions,
  getMovementOptions,
  buildOutdoorStatusLines,
  handleOutdoorChooseAction,
} from "../../../composables/usePlayPanel.js";
import {
  buildMapMovementAudit,
  movementAuditSummary,
} from "../debug/mapMovementAudit.js";

const props = defineProps({
  outdoor: { type: Object, required: true },
  indoor: { type: Object, required: true },
  narrativeBeat: { type: Object, default: null },
  pendingBeat: { type: Object, default: null },
  applyChoice: { type: Function, required: true },
  travelToHex: { type: Function, required: true },
  enterBuilding: { type: Function, required: true },
  auditEnabled: { type: Boolean, default: false },
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

function onAction(id) {
  handleOutdoorChooseAction(
    props.outdoor,
    props.applyChoice,
    id,
    props.travelToHex,
  );
}
</script>

<style scoped>
.stage {
  display: block;
  margin-bottom: 1rem;
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
