<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import StoryBeatEditor from "../components/builder/story/StoryBeatEditor.vue";
import StoryBeatList from "../components/builder/story/StoryBeatList.vue";
import StoryLocationPicker from "../components/builder/story/StoryLocationPicker.vue";
import StoryMilestonePanel from "../components/builder/story/StoryMilestonePanel.vue";
import BuilderPageHeader from "../components/builder/BuilderPageHeader.vue";
import BuilderWorkspaceTabs from "../components/builder/BuilderWorkspaceTabs.vue";
import UnsavedChangesDialog from "../components/builder/UnsavedChangesDialog.vue";
import { useOutdoorWorld } from "../lib/maps/composables/useOutdoorWorld.js";
import { buildBuilding } from "../lib/maps/composables/useGrid.js";
import { storyApi } from "../lib/storyApi.js";
import {
  choiceDestinationType,
  createEmptyChoice,
  setChoiceDestinationType,
  setChoiceViewKind as applyChoiceViewKind,
} from "../lib/storyChoiceDrafts.js";
import { useDirtyDocumentNavigation } from "../composables/useDirtyDocumentNavigation.js";
import { useStoryBeatDocument } from "../composables/useStoryBeatDocument.js";
import { useWorldContent } from "../composables/useWorldContent.js";
import { useBuildingContent } from "../composables/useBuildingContent.js";
import { hexDistance } from "../lib/maps/composables/useHexGeometry.js";

const { worldData, revision: worldRevision } = useWorldContent();
const { buildingData, revision: buildingRevision } = useBuildingContent();
const mapData = JSON.parse(JSON.stringify(worldData.value));
const outdoor = useOutdoorWorld(mapData);
const building = computed(() => buildBuilding(buildingData.value));
const allHexIds = computed(() => outdoor.editableHexes.map((item) => item.id));
const allRoomIds = computed(() => buildingData.value.rooms.map((item) => item.id));
const allExteriorIds = computed(() =>
  (buildingData.value.exterior?.nodes ?? []).map((item) => item.id),
);
const allHexSet = computed(() => new Set(allHexIds.value));
const builderFlags = new Set();
const STORY_AREA_ID = "part-i";
const route = useRoute();
const router = useRouter();

const catalog = ref({ world: { hexes: [], rooms: [], exteriorNodes: [], localExits: [], mapTransitions: [], buildings: [] } });
const locationMode = ref("outdoors");
const selectedLocation = ref(mapData.start);
const indoorLevel = ref(
  buildingData.value.exterior?.level ?? buildingData.value.levels.at(-1)?.id,
);
const indoorViewportMode = ref("fit-all");
const storyWorkspaceTabs = [
  { id: "outdoors", label: "Area" },
  { id: "rooms", label: "Utility Station" },
  { id: "milestones", label: "Milestones" },
];
const activeWorkspace = ref("outdoors");
const storyWorkspace = computed(() =>
  activeWorkspace.value === "milestones"
    ? "milestones"
    : locationMode.value === "outdoors" ? "outdoors" : "rooms",
);
const milestones = ref([]);
const milestoneDialog = ref({
  visible: false,
  field: null,
  label: "",
  id: "",
  kind: "story",
});
const {
  beats,
  selectedBeatId,
  draft,
  isNew,
  errors,
  status,
  revisions,
  showRevisions,
  dirty,
  clearBeatSelection,
  loadBeat,
  loadBeats,
  openFirstBeatForSelectedLocation,
  beginNewBeat,
  revertDraft,
  saveBeat,
  deleteBeat,
  loadRevisions,
  restoreRevision,
} = useStoryBeatDocument({
  areaId: STORY_AREA_ID,
  getCurrentLocation: () => ({
    mode: locationMode.value,
    location: selectedLocation.value,
  }),
  getSelectedLocationKey: selectedLocationKey,
  getBeatsForLocation: beatsForLocation,
  createEmptyBeat: emptyBeat,
  suggestedId,
});
const navigation = useDirtyDocumentNavigation({
  dirty,
  router,
  save: () => saveBeat(),
  discard: () => clearBeatSelection(),
  onError: (error) => {
    status.value = error.message ?? "Could not finish changing context.";
  },
});
function beatsForLocation(mode, location) {
  return beats.value.filter((beat) => {
    if (mode === "outdoors") return beat.trigger.hex === location;
    if (mode === "rooms") return beat.trigger.room === location;
    if (mode === "exterior") return beat.trigger.exteriorNode === location;
    return false;
  });
}
const locationBeats = computed(() =>
  beatsForLocation(locationMode.value, selectedLocation.value),
);
const displayedLocationBeats = computed(() => {
  const currentDraft = draft.value;
  if (!currentDraft || !selectedBeatId.value) return locationBeats.value;
  return locationBeats.value.map((beat) =>
    beat.id === selectedBeatId.value ? currentDraft : beat,
  );
});
function originHexLabel(value) {
  const origins = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : value
        ? [value]
        : [];
  return origins.join("|");
}
function timeCriteriaParts(time = {}) {
  const parts = [];
  if (Array.isArray(time.days) && time.days.length) {
    parts.push(`day=${[...time.days].map(Number).filter(Number.isFinite).sort((a, b) => a - b).join("|")}`);
  }
  if (time.dayFrom != null) parts.push(`dayFrom=${time.dayFrom}`);
  if (time.dayTo != null) parts.push(`dayTo=${time.dayTo}`);
  if (time.phase) parts.push(`phase=${time.phase}`);
  if (time.minuteOfDayFrom != null) parts.push(`minuteFrom=${time.minuteOfDayFrom}`);
  if (time.minuteOfDayTo != null) parts.push(`minuteTo=${time.minuteOfDayTo}`);
  if (time.elapsedFrom != null) parts.push(`elapsedFrom=${time.elapsedFrom}`);
  if (time.elapsedTo != null) parts.push(`elapsedTo=${time.elapsedTo}`);
  if (time.afterMilestone) parts.push(`after=${time.afterMilestone}`);
  if (time.beforeMilestone) parts.push(`before=${time.beforeMilestone}`);
  return parts;
}
function timeCriteriaLabel(time = {}) {
  const labels = [];
  if (Array.isArray(time.days) && time.days.length) labels.push(`Day #: ${time.days.join(", ")}`);
  if (time.dayFrom != null) labels.push(`Day from: ${time.dayFrom}`);
  if (time.dayTo != null) labels.push(`Day to: ${time.dayTo}`);
  if (time.phase) labels.push(`Time of day: ${time.phase}`);
  if (time.minuteOfDayFrom != null) labels.push(`minute from ${time.minuteOfDayFrom}`);
  if (time.minuteOfDayTo != null) labels.push(`minute to ${time.minuteOfDayTo}`);
  if (time.elapsedFrom != null) labels.push(`elapsed from ${time.elapsedFrom}`);
  if (time.elapsedTo != null) labels.push(`elapsed to ${time.elapsedTo}`);
  if (time.afterMilestone) labels.push(`after ${time.afterMilestone}`);
  if (time.beforeMilestone) labels.push(`before ${time.beforeMilestone}`);
  return labels.join(", ");
}
const matchWarnings = computed(() => {
  const groups = new Map();
  for (const beat of displayedLocationBeats.value) {
    const origin = originHexLabel(beat.match?.originHex);
    const mapTransition = beat.match?.mapTransition ?? beat.match?.localExit ?? "";
    const direction = beat.match?.transitionDirection ?? "";
    const time = timeCriteriaParts(beat.time).join(":");
    const key = `${locationMode.value}:${selectedLocation.value}:origin=${origin}:mapTransition=${mapTransition}:direction=${direction}:time=${time}`;
    const group = groups.get(key) ?? [];
    group.push(beat);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const origin = originHexLabel(group[0].match?.originHex);
      const mapTransition = group[0].match?.mapTransition ?? group[0].match?.localExit;
      const direction = group[0].match?.transitionDirection;
      const label = [
        origin ? `origin ${origin}` : "",
        mapTransition ? `map transition ${mapTransition}` : "",
        direction ? (direction === "toLocal" ? "to local map" : "to regional map") : "",
        timeCriteriaLabel(group[0].time),
      ].filter(Boolean).join(", ") || "default/no origin or map transition";
      return `Multiple beats use ${label}: ${group.map((beat) => beat.id).join(", ")}. The first sorted beat wins.`;
    });
});
const draftIsOutdoorHexBeat = computed(() =>
  draft.value?.trigger?.place === "outdoors" && Boolean(draft.value?.trigger?.hex),
);
const originHexOptions = computed(() => {
  if (!draftIsOutdoorHexBeat.value) return [];
  const triggerHex = draft.value?.trigger?.hex;
  const destination = outdoor.hexById[triggerHex];
  if (!destination) return [];
  const options = catalog.value.world.hexes.filter((hex) =>
    hex.id !== triggerHex && hexDistance(destination, outdoor.hexById[hex.id] ?? hex) === 1,
  );
  return options;
});
const selectedRoom = computed(() => locationMode.value === "rooms" ? selectedLocation.value : "");
const selectedExterior = computed(() => locationMode.value === "exterior" ? selectedLocation.value : null);
onMounted(async () => {
  try {
    catalog.value = await storyApi("/api/catalog");
    await loadMilestones();
    await loadBeats();
    await applyStoryRouteQuery();
  } catch (error) {
    status.value = error.message;
  }
});

async function loadMilestones() {
  milestones.value = await storyApi(`/api/story/areas/${STORY_AREA_ID}/milestones`);
}

async function saveMilestones(nextMilestones = milestones.value) {
  const result = await storyApi(`/api/story/areas/${STORY_AREA_ID}/milestones`, {
    method: "PUT",
    body: JSON.stringify({ milestones: nextMilestones }),
  });
  milestones.value = result.milestones;
  return result.milestones;
}

watch(worldRevision, async () => {
  const next = worldData.value;
  outdoor.syncFromMapData(next);
  if (!allHexSet.value.has(selectedLocation.value)) {
    selectedLocation.value = next.start;
    outdoor.state.currentId = next.start;
    clearBeatSelection();
  }
  try {
    catalog.value = await storyApi("/api/catalog");
  } catch (error) {
    status.value = error.message;
  }
});

watch(buildingRevision, async () => {
  if (!buildingData.value.levels.some((item) => item.id === indoorLevel.value)) {
    indoorLevel.value = buildingData.value.exterior?.level
      ?? buildingData.value.levels.at(-1)?.id;
  }
  if (locationMode.value === "rooms" && !allRoomIds.value.includes(selectedLocation.value)) {
    applyRoomSelection(buildingData.value.rooms[0]?.id);
  }
  if (
    locationMode.value === "exterior" &&
    !allExteriorIds.value.includes(selectedLocation.value)
  ) {
    applyExteriorSelection(buildingData.value.exterior?.entry);
  }
  try {
    catalog.value = await storyApi("/api/catalog");
  } catch (error) {
    status.value = error.message;
  }
});

function selectBeat(id) {
  if (selectedBeatId.value === id) return;
  void requestContextChange(() => loadBeat(id));
}

function selectHex(id) {
  if (locationMode.value === "outdoors" && selectedLocation.value === id) return;
  void requestContextChange(() => applyHexSelection(id));
}

async function applyHexSelection(id) {
  locationMode.value = "outdoors";
  selectedLocation.value = id;
  outdoor.state.currentId = id;
  clearBeatSelection();
  await openFirstBeatForSelectedLocation();
}

function selectedLocationKey() {
  return `${locationMode.value}:${selectedLocation.value}`;
}

function selectRoom(id) {
  if (locationMode.value === "rooms" && selectedLocation.value === id) return;
  void requestContextChange(() => applyRoomSelection(id));
}

async function applyRoomSelection(id) {
  locationMode.value = "rooms";
  selectedLocation.value = id;
  const room = building.value.roomById[id];
  if (room?.level) indoorLevel.value = room.level;
  clearBeatSelection();
  await openFirstBeatForSelectedLocation();
}

function selectExterior(id) {
  if (locationMode.value === "exterior" && selectedLocation.value === id) return;
  void requestContextChange(() => applyExteriorSelection(id));
}

function selectIndoorMapItem({ source, id }) {
  if (source === "rooms") {
    selectRoom(id);
  } else if (source === "nodes") {
    selectExterior(id);
  } else if (source === "exits") {
    const transition = building.value.exitById?.[id] ?? building.value.exitByDoorId?.[id];
    if (transition?.exteriorNode) {
      selectExterior(transition.exteriorNode);
    }
  }
}

async function applyExteriorSelection(id) {
  locationMode.value = "exterior";
  selectedLocation.value = id;
  indoorLevel.value = buildingData.value.exterior?.level ?? indoorLevel.value;
  clearBeatSelection();
  await openFirstBeatForSelectedLocation();
}

function switchMode(mode) {
  if (mode === "milestones") {
    if (activeWorkspace.value === "milestones") return;
    void requestContextChange(() => {
      activeWorkspace.value = "milestones";
    });
    return;
  }
  if (
    (mode === "outdoors" && locationMode.value === "outdoors" && activeWorkspace.value !== "milestones") ||
    (mode === "rooms" && ["rooms", "exterior"].includes(locationMode.value) && activeWorkspace.value !== "milestones")
  ) {
    return;
  }
  void requestContextChange(() => applyModeSelection(mode));
}

async function applyModeSelection(mode) {
  activeWorkspace.value = mode === "outdoors" ? "outdoors" : "rooms";
  if (mode === "outdoors") {
    await applyHexSelection(outdoor.mapData.start);
  } else if (mode === "rooms") {
    await applyRoomSelection(buildingData.value.rooms[0]?.id);
  } else if (mode === "exterior") {
    await applyExteriorSelection(buildingData.value.exterior?.entry);
  }
}

function milestoneIdFromLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .replace(/([.-]){2,}/g, "$1");
}

function uniqueMilestoneId(base) {
  const used = new Set(milestones.value.map((item) => item.id));
  const root = base || "new-milestone";
  let candidate = root;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${root}-${suffix++}`;
  return candidate;
}

function openMilestoneDialog({ field = null } = {}) {
  milestoneDialog.value = {
    visible: true,
    field,
    label: "",
    id: "",
    kind: "story",
  };
}

function cancelMilestoneDialog() {
  milestoneDialog.value.visible = false;
}

async function createMilestoneFromDialog() {
  const label = milestoneDialog.value.label.trim();
  const id = uniqueMilestoneId(milestoneDialog.value.id.trim() || milestoneIdFromLabel(label));
  const next = [
    ...milestones.value,
    {
      id,
      label: label || id,
      kind: milestoneDialog.value.kind,
      description: null,
    },
  ];
  try {
    await saveMilestones(next);
    if (draft.value && milestoneDialog.value.field) {
      draft.value.time[milestoneDialog.value.field] = id;
    }
    milestoneDialog.value.visible = false;
  } catch (error) {
    status.value = error.message;
  }
}

async function updateMilestone({ index, milestone }) {
  const next = milestones.value.map((item, itemIndex) =>
    itemIndex === index ? milestone : item,
  );
  try {
    await saveMilestones(next);
  } catch (error) {
    status.value = error.message;
  }
}

async function removeMilestone(index) {
  const next = milestones.value.filter((_, itemIndex) => itemIndex !== index);
  try {
    await saveMilestones(next);
  } catch (error) {
    status.value = error.message;
  }
}

function setMilestoneCriterion({ field, value }) {
  if (!draft.value) return;
  draft.value.time[field] = value;
}

function newBeat(copy = null) {
  void requestContextChange(() => beginNewBeat(copy));
}

function emptyBeat() {
  const trigger = { place: null, hex: null, room: null, exteriorNode: null, event: null, flag: null };
  if (locationMode.value === "outdoors") Object.assign(trigger, { place: "outdoors", hex: selectedLocation.value });
  if (locationMode.value === "rooms") Object.assign(trigger, { place: "indoors", room: selectedLocation.value });
  if (locationMode.value === "exterior") Object.assign(trigger, { place: "indoors", exteriorNode: selectedLocation.value });
  return {
    id: "",
    eyebrow: "",
    heading: "",
    text: "",
    revisit: "",
    trigger,
    match: { originHex: null, localExit: null, mapTransition: null, transitionDirection: null },
    time: {
      days: [],
      dayFrom: null,
      dayTo: null,
      minuteOfDayFrom: null,
      minuteOfDayTo: null,
      phase: null,
      elapsedFrom: null,
      elapsedTo: null,
      afterMilestone: null,
      beforeMilestone: null,
    },
    choices: [],
  };
}

function suggestedId() {
  return String(selectedLocation.value || "new-beat").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}


function addChoice() {
  draft.value.choices.push(createEmptyChoice({ order: draft.value.choices.length }));
}

function moveChoice(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= draft.value.choices.length) return;
  const [choice] = draft.value.choices.splice(index, 1);
  draft.value.choices.splice(next, 0, choice);
  draft.value.choices.forEach((item, order) => { item.order = order; });
}

function setCsv(target, key, event) {
  target[key] = event.target.value.split(",").map((item) => item.trim()).filter(Boolean);
}

function destinationType(choice) {
  return choiceDestinationType(choice);
}

function setDestinationType(choice, type) {
  setChoiceDestinationType(choice, type, catalog.value);
}

function setChoiceViewKind(choice, kind) {
  applyChoiceViewKind(choice, kind);
}

function requestContextChange(action) {
  return navigation.requestChange(action);
}

function queryText(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function applyStoryRouteQuery() {
  const mode = queryText(route.query.mode);
  const location = queryText(route.query.location);
  if (!mode || !location) return;

  if (mode === "outdoors") {
    await applyHexSelection(location);
  } else if (mode === "rooms") {
    await applyRoomSelection(location);
  } else if (mode === "exterior") {
    await applyExteriorSelection(location);
  } else {
    return;
  }

  const beatId = queryText(route.query.beat);
  if (beatId) {
    await loadBeat(beatId);
    return;
  }

  if (queryText(route.query.create) !== "1") return;
  beginNewBeat();

  const mapTransition = queryText(route.query.mapTransition);
  const transitionDirection = queryText(route.query.transitionDirection);
  if (!mapTransition || !transitionDirection) return;

  if (draft.value) {
    draft.value.match.mapTransition = mapTransition;
    draft.value.match.transitionDirection = transitionDirection;
    draft.value.match.localExit = null;
  }
}

</script>

<template>
  <main class="builder-page">
    <BuilderPageHeader title="Story Builder">
      <template #tabs>
        <BuilderWorkspaceTabs
          aria-label="Story builder map"
          :items="storyWorkspaceTabs"
          :active-id="storyWorkspace"
          @select="switchMode"
        />
      </template>
    </BuilderPageHeader>

    <div v-if="storyWorkspace !== 'milestones'" class="builder-workspace">
      <div class="builder-nav-column">
        <StoryLocationPicker
          v-model:indoor-level="indoorLevel"
          v-model:indoor-viewport-mode="indoorViewportMode"
          :location-mode="locationMode"
          :selected-location="selectedLocation"
          :outdoor="outdoor"
          :building="building"
          :building-data="buildingData"
          :all-hex-ids="allHexIds"
          :all-hex-set="allHexSet"
          :all-room-ids="allRoomIds"
          :all-exterior-ids="allExteriorIds"
          :builder-flags="builderFlags"
          :selected-room="selectedRoom"
          :selected-exterior="selectedExterior"
          @select-hex="selectHex"
          @select-room="selectRoom"
          @select-exterior="selectExterior"
          @select-indoor-item="selectIndoorMapItem"
        />

        <StoryBeatList
          :selected-location="selectedLocation"
          :beats="displayedLocationBeats"
          :selected-beat-id="selectedBeatId"
          :warnings="matchWarnings"
          @new="newBeat()"
          @select="selectBeat"
        />
      </div>

      <StoryBeatEditor
        :draft="draft"
        :dirty="Boolean(dirty)"
        :is-new="isNew"
        :status="status"
        :errors="errors"
        :catalog="catalog"
        :milestones="milestones"
        :draft-is-outdoor-hex-beat="draftIsOutdoorHexBeat"
        :show-revisions="showRevisions"
        :revisions="revisions"
        :destination-type="destinationType"
        :selected-location="selectedLocation"
        :origin-hex-options="originHexOptions"
        @save="saveBeat"
        @revert="revertDraft"
        @duplicate="newBeat"
        @history="loadRevisions"
        @delete="deleteBeat"
        @add-choice="addChoice"
        @move-choice="moveChoice($event.index, $event.delta)"
        @remove-choice="draft.choices.splice($event, 1)"
        @set-csv="setCsv($event.choice, $event.key, $event.event)"
        @set-destination-type="setDestinationType($event.choice, $event.type)"
        @set-view-kind="setChoiceViewKind($event.choice, $event.kind)"
        @new-milestone="openMilestoneDialog"
        @set-milestone="setMilestoneCriterion"
        @restore-revision="restoreRevision"
      />
    </div>

    <div v-else class="milestone-workspace">
      <StoryMilestonePanel
        :milestones="milestones"
        :status="status"
        @new="openMilestoneDialog({ field: null })"
        @update="updateMilestone"
        @remove="removeMilestone"
      />
    </div>

    <UnsavedChangesDialog
      :visible="navigation.promptVisible.value"
      title="Save before leaving this beat?"
      message="You can save these edits, discard them, or return to the editor without changing context."
      :status="status"
      :saving="navigation.saving.value"
      @save="navigation.saveAndContinue"
      @discard="navigation.discardAndContinue"
      @keep="navigation.keepEditing"
    />

    <div v-if="milestoneDialog.visible" class="modal-backdrop" role="presentation">
      <form class="milestone-dialog panel" @submit.prevent="createMilestoneFromDialog">
        <h2>New milestone</h2>
        <label>Name
          <input v-model="milestoneDialog.label" autofocus>
        </label>
        <label>ID
          <input
            :value="milestoneDialog.id || milestoneIdFromLabel(milestoneDialog.label)"
            @input="milestoneDialog.id = $event.target.value"
          >
        </label>
        <label>Kind
          <select v-model="milestoneDialog.kind">
            <option value="story">story</option>
            <option value="discovery">discovery</option>
            <option value="knowledge">knowledge</option>
            <option value="application">application</option>
            <option value="operations">operations</option>
            <option value="survival">survival</option>
            <option value="world">world</option>
          </select>
        </label>
        <div class="dialog-actions">
          <button type="button" class="sm muted" @click="cancelMilestoneDialog">Cancel</button>
          <button type="submit" class="sm">Create</button>
        </div>
      </form>
    </div>
  </main>
</template>

<style scoped>
.builder-page {
  max-width: 1500px;
  height: calc(100vh - 4.25rem);
  margin: 0 auto;
  overflow: hidden;
  padding: .75rem 1rem;
}
.open-menu { position: relative; }
.open-menu summary {
  list-style: none;
  user-select: none;
  background: #252a33;
  color: #9aa0ac;
  border: 1px solid #3a404a;
  border-radius: 8px;
  padding: .35rem .65rem;
  font-size: .82rem;
  cursor: pointer;
}
.open-menu summary::-webkit-details-marker { display: none; }
.open-menu summary::after { content: " ▾"; }
.open-menu[open] summary { background: #323945; color: #d5d9df; }
.open-menu-popover {
  position: absolute;
  z-index: 20;
  top: calc(100% + .35rem);
  right: 0;
  min-width: 10rem;
  padding: .35rem;
  border: 1px solid #465166;
  border-radius: 8px;
  background: #202630;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .35);
}
.open-menu-item {
  width: 100%;
  border: 0;
  background: transparent;
  padding: .45rem .55rem;
  text-align: left;
  white-space: nowrap;
}
.open-menu-item:hover:not(:disabled) { background: #344158; }
.builder-workspace {
  display: grid;
  grid-template-columns: minmax(360px, .9fr) minmax(520px, 1.45fr);
  gap: 1rem;
  height: calc(100% - 3rem);
  min-height: 0;
  margin-top: .75rem;
  align-items: stretch;
}
.builder-nav-column {
  display: grid;
  gap: .75rem;
  align-content: start;
  min-height: 0;
  max-height: 100%;
  overflow: auto;
}
.builder-form-column {
  max-height: 100%;
  overflow: auto;
}
.milestone-workspace {
  height: calc(100% - 3rem);
  min-height: 0;
  margin-top: .75rem;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(7, 10, 14, .65);
}
.milestone-dialog {
  display: grid;
  gap: .75rem;
  width: min(28rem, 100%);
}
.milestone-dialog h2 {
  margin: 0;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: .5rem;
}
@media (max-width: 1100px) {
  .builder-workspace { grid-template-columns: minmax(320px, .85fr) minmax(420px, 1.15fr); }
}
@media (max-width: 820px) {
  .builder-workspace { grid-template-columns: 1fr; }
}
</style>
