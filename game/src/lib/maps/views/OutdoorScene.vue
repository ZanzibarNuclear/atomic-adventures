<template>
  <div v-if="devMode" class="audit-controls">
    <button type="button" class="audit-toggle" @click="auditEnabled = !auditEnabled">
      {{ auditEnabled ? "Hide movement audit" : "Show movement audit" }}
    </button>
    <select v-if="auditEnabled" v-model="auditState" aria-label="Movement audit state">
      <option value="all">All movement states</option>
      <option v-for="state in auditStates" :key="state" :value="state">
        {{ state }}
      </option>
    </select>
    <span v-if="auditEnabled" class="audit-summary">
      {{ auditSummary.valid }} valid · {{ auditSummary.blocked }} blocked ·
      {{ auditSummary.invalid }} invalid
    </span>
  </div>

  <section class="stage">
    <HexMap
      :map-data="outdoor.displayMapData"
      :route-models="outdoor.routeModels"
      :feature-models="outdoor.featureModels"
      :current-hex="outdoor.state.currentId"
      :discovered="auditEnabled ? allHexIds : outdoor.discoveredList"
      :discovered-openings="outdoor.state.discoveredOpenings"
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
import { computed, ref } from "vue";
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
});

const devMode = import.meta.env.DEV;
const auditEnabled = ref(false);
const auditState = ref("all");
const allHexIds = computed(() =>
  (props.outdoor.displayMapData.hexes ?? []).map((hex) => hex.id),
);
const auditEntries = computed(() =>
  devMode && auditEnabled.value
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
.audit-toggle,
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
</style>
