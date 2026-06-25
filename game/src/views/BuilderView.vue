<script setup>
import { computed, onMounted, ref, toRaw, watch } from "vue";
import { useRouter } from "vue-router";
import StoryBeatEditor from "../components/builder/story/StoryBeatEditor.vue";
import StoryBeatList from "../components/builder/story/StoryBeatList.vue";
import StoryLocationPicker from "../components/builder/story/StoryLocationPicker.vue";
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
import { storyBeatYaml } from "../lib/storyYamlPreview.js";
import { useDirtyDocumentNavigation } from "../composables/useDirtyDocumentNavigation.js";
import { useWorldContent } from "../composables/useWorldContent.js";
import { useBuildingContent } from "../composables/useBuildingContent.js";

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
const router = useRouter();

const catalog = ref({ world: { hexes: [], rooms: [], exteriorNodes: [], localExits: [], buildings: [] } });
const beats = ref([]);
const selectedBeatId = ref("");
const locationMode = ref("outdoors");
const selectedLocation = ref(mapData.start);
const indoorLevel = ref(
  buildingData.value.exterior?.level ?? buildingData.value.levels.at(-1)?.id,
);
const indoorViewportMode = ref("fit-all");
const previewExteriorFog = ref(false);
const draft = ref(null);
const baseline = ref("");
const isNew = ref(false);
const errors = ref({});
const status = ref("");
const revisions = ref([]);
const showRevisions = ref(false);
const eventLocationInput = ref("custom-event");
let beatLoadRequest = 0;

function clonePlain(value) {
  return JSON.parse(JSON.stringify(toRaw(value)));
}

const dirty = computed(() => draft.value && JSON.stringify(draft.value) !== baseline.value);
const yamlPreview = computed(() => storyBeatYaml(draft.value));
const navigation = useDirtyDocumentNavigation({
  dirty,
  router,
  save: () => saveBeat(),
  discard: () => clearBeatSelection(),
  keep: () => {
    eventLocationInput.value = selectedLocation.value;
  },
  onError: (error) => {
    status.value = error.message ?? "Could not finish changing context.";
  },
});
function beatsForLocation(mode, location) {
  return beats.value.filter((beat) => {
    if (mode === "outdoors") return beat.trigger.hex === location;
    if (mode === "rooms") return beat.trigger.room === location;
    if (mode === "exterior") return beat.trigger.exteriorNode === location;
    return Boolean(beat.trigger.event);
  });
}
const locationBeats = computed(() =>
  beatsForLocation(locationMode.value, selectedLocation.value),
);
const matchWarnings = computed(() => {
  const groups = new Map();
  for (const beat of locationBeats.value) {
    const origin = beat.match?.originHex ?? "";
    const localExit = beat.match?.localExit ?? "";
    const key = `${locationMode.value}:${selectedLocation.value}:origin=${origin}:localExit=${localExit}`;
    const group = groups.get(key) ?? [];
    group.push(beat);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const origin = group[0].match?.originHex;
      const localExit = group[0].match?.localExit;
      const label = [
        origin ? `origin ${origin}` : "",
        localExit ? `local exit ${localExit}` : "",
      ].filter(Boolean).join(", ") || "default/no origin or local exit";
      return `Multiple beats use ${label}: ${group.map((beat) => beat.id).join(", ")}. The first sorted beat wins.`;
    });
});
const draftIsOutdoorHexBeat = computed(() =>
  draft.value?.trigger?.place === "outdoors" && Boolean(draft.value?.trigger?.hex),
);
const selectedRoom = computed(() => locationMode.value === "rooms" ? selectedLocation.value : "");
const selectedExterior = computed(() => locationMode.value === "exterior" ? selectedLocation.value : null);
onMounted(async () => {
  try {
    catalog.value = await storyApi("/api/catalog");
    await loadBeats();
  } catch (error) {
    status.value = error.message;
  }
});

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

async function loadBeats(selectId = "") {
  await refreshBeatList();
  if (selectId) await loadBeat(selectId);
  else await openFirstBeatForSelectedLocation();
}

async function refreshBeatList() {
  beats.value = await storyApi(`/api/story/areas/${STORY_AREA_ID}/beats`);
}

async function loadBeat(id, selectionKey = selectedLocationKey()) {
  const request = ++beatLoadRequest;
  const result = await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(id)}`,
  );
  if (request !== beatLoadRequest || selectionKey !== selectedLocationKey()) return;
  selectedBeatId.value = id;
  isNew.value = false;
  setDraft(result.beat);
}

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

function clearBeatSelection() {
  beatLoadRequest += 1;
  selectedBeatId.value = "";
  draft.value = null;
  baseline.value = "";
  isNew.value = false;
  errors.value = {};
  status.value = "";
}

function selectedLocationKey() {
  return `${locationMode.value}:${selectedLocation.value}`;
}

async function openFirstBeatForSelectedLocation(
  mode = locationMode.value,
  location = selectedLocation.value,
) {
  const selectionKey = `${mode}:${location}`;
  const firstBeat = beatsForLocation(mode, location)[0];
  if (!firstBeat) return;
  const request = ++beatLoadRequest;

  try {
    const result = await storyApi(
      `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(firstBeat.id)}`,
    );
    if (request !== beatLoadRequest || selectionKey !== selectedLocationKey()) return;
    selectedBeatId.value = firstBeat.id;
    isNew.value = false;
    setDraft(result.beat);
  } catch (error) {
    if (request === beatLoadRequest && selectionKey === selectedLocationKey()) {
      status.value = error.message;
    }
  }
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
  if (
    (mode === "outdoors" && locationMode.value === "outdoors") ||
    (mode === "rooms" && ["rooms", "exterior"].includes(locationMode.value)) ||
    (mode === "events" && locationMode.value === "events")
  ) {
    return;
  }
  void requestContextChange(() => applyModeSelection(mode));
}

async function applyModeSelection(mode) {
  if (mode === "outdoors") {
    await applyHexSelection(outdoor.mapData.start);
  } else if (mode === "rooms") {
    await applyRoomSelection(buildingData.value.rooms[0]?.id);
  } else if (mode === "exterior") {
    await applyExteriorSelection(buildingData.value.exterior?.entry);
  } else {
    locationMode.value = "events";
    selectedLocation.value = "custom-event";
    eventLocationInput.value = selectedLocation.value;
    clearBeatSelection();
  }
}

function selectEventLocation(event) {
  const next = event.target.value.trim() || "custom-event";
  if (next === selectedLocation.value) return;
  void requestContextChange(() => {
    locationMode.value = "events";
    selectedLocation.value = next;
    eventLocationInput.value = next;
    clearBeatSelection();
  });
}

function newBeat(copy = null) {
  void requestContextChange(() => beginNewBeat(copy));
}

function beginNewBeat(copy = null) {
  const source = copy ? clonePlain(copy) : emptyBeat();
  source.id = uniqueId(copy ? `${copy.id}-copy` : suggestedId());
  source.version = undefined;
  source.choices = (source.choices ?? []).map((choice) => ({ ...choice, id: crypto.randomUUID() }));
  selectedBeatId.value = "";
  isNew.value = true;
  setDraft(source);
}

function emptyBeat() {
  const trigger = { place: null, hex: null, room: null, exteriorNode: null, event: null, flag: null };
  if (locationMode.value === "outdoors") Object.assign(trigger, { place: "outdoors", hex: selectedLocation.value });
  if (locationMode.value === "rooms") Object.assign(trigger, { place: "indoors", room: selectedLocation.value });
  if (locationMode.value === "exterior") Object.assign(trigger, { place: "indoors", exteriorNode: selectedLocation.value });
  if (locationMode.value === "events") trigger.event = selectedLocation.value || "custom-event";
  return {
    id: "",
    eyebrow: "",
    heading: "",
    text: "",
    revisit: "",
    trigger,
    match: { originHex: null, localExit: null },
    choices: [],
  };
}

function suggestedId() {
  return String(selectedLocation.value || "new-beat").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueId(base) {
  const used = new Set(beats.value.map((beat) => beat.id));
  let candidate = base || "new-beat";
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function setDraft(value) {
  const next = clonePlain(value);
  next.match ??= { originHex: null, localExit: null };
  next.match.originHex ??= null;
  next.match.localExit ??= null;
  draft.value = next;
  baseline.value = JSON.stringify(draft.value);
  errors.value = {};
  status.value = "";
  revisions.value = [];
  showRevisions.value = false;
}

function revertDraft() {
  draft.value = JSON.parse(baseline.value);
  errors.value = {};
}

async function saveBeat() {
  if (!draft.value) return false;
  errors.value = {};
  status.value = "Saving…";
  try {
    const submitted = clonePlain(draft.value);
    let result;
    if (isNew.value) {
      result = await storyApi(`/api/story/areas/${STORY_AREA_ID}/beats`, {
        method: "POST",
        body: JSON.stringify(submitted),
      });
    } else {
      result = await storyApi(
        `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(selectedBeatId.value)}`,
        {
          method: "PUT",
          body: JSON.stringify({ beat: submitted, expectedVersion: submitted.version }),
        },
      );
    }
    selectedBeatId.value = result.beat.id;
    isNew.value = false;
    const submittedOrigin = submitted.match?.originHex ?? null;
    const savedOrigin = result.beat.match?.originHex ?? null;
    const submittedLocalExit = submitted.match?.localExit ?? null;
    const savedLocalExit = result.beat.match?.localExit ?? null;
    if (submittedOrigin !== savedOrigin || submittedLocalExit !== savedLocalExit) {
      const saved = clonePlain(result.beat);
      const editable = clonePlain(result.beat);
      editable.match = {
        ...(editable.match ?? {}),
        originHex: submittedOrigin,
        localExit: submittedLocalExit,
      };
      draft.value = editable;
      baseline.value = JSON.stringify(saved);
      await refreshBeatList();
      status.value = "The content API did not preserve the match criteria. Restart the game dev server, then save again.";
      return false;
    }
    setDraft(result.beat);
    await refreshBeatList();
    status.value = result.renamedFrom
      ? `Renamed ${result.renamedFrom} to ${result.beat.id} and saved revision ${result.beat.version}.`
      : `Saved revision ${result.beat.version}.`;
    return true;
  } catch (error) {
    errors.value = error.errors ?? {};
    status.value = error.status === 409
      ? "This beat changed elsewhere. Reload it before saving."
      : error.message;
    return false;
  }
}

async function deleteBeat() {
  if (!draft.value || isNew.value) return;
  const beatId = selectedBeatId.value;
  if (!window.confirm(`Delete "${beatId}"? Its revision history will remain available.`)) return;
  await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(beatId)}`,
    { method: "DELETE", body: JSON.stringify({ expectedVersion: draft.value.version }) },
  );
  draft.value = null;
  selectedBeatId.value = "";
  baseline.value = "";
  await loadBeats();
}

async function loadRevisions() {
  if (!draft.value || isNew.value) return;
  revisions.value = await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(selectedBeatId.value)}/revisions`,
  );
  showRevisions.value = true;
}

async function restoreRevision(revision) {
  if (!window.confirm(`Restore revision ${revision}? This creates a new revision.`)) return;
  const result = await storyApi(
    `/api/story/areas/${STORY_AREA_ID}/beats/${encodeURIComponent(selectedBeatId.value)}/revisions/${revision}/restore`,
    { method: "POST" },
  );
  selectedBeatId.value = result.beat.id;
  setDraft(result.beat);
  await loadBeats();
  await loadRevisions();
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

</script>

<template>
  <main class="builder-page">
    <div class="builder-workspace">
      <StoryLocationPicker
        v-model:indoor-level="indoorLevel"
        v-model:indoor-viewport-mode="indoorViewportMode"
        v-model:preview-exterior-fog="previewExteriorFog"
        v-model:event-location-input="eventLocationInput"
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
        @switch-mode="switchMode"
        @select-hex="selectHex"
        @select-room="selectRoom"
        @select-exterior="selectExterior"
        @select-indoor-item="selectIndoorMapItem"
        @select-event="selectEventLocation"
      />

      <StoryBeatList
        :selected-location="selectedLocation"
        :beats="locationBeats"
        :selected-beat-id="selectedBeatId"
        :warnings="matchWarnings"
        @new="newBeat()"
        @select="selectBeat"
      />

      <StoryBeatEditor
        :draft="draft"
        :dirty="Boolean(dirty)"
        :is-new="isNew"
        :status="status"
        :errors="errors"
        :catalog="catalog"
        :yaml-preview="yamlPreview"
        :draft-is-outdoor-hex-beat="draftIsOutdoorHexBeat"
        :show-revisions="showRevisions"
        :revisions="revisions"
        :destination-type="destinationType"
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
        @restore-revision="restoreRevision"
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
  </main>
</template>

<style scoped>
.builder-page { max-width: 1500px; margin: 0 auto; padding: 1rem; }
.builder-header,
.builder-header-actions {
  display: flex; align-items: center; justify-content: space-between; gap: .65rem; flex-wrap: wrap;
}
.builder-header h1 { margin: 0; }
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
.builder-workspace { display: grid; grid-template-columns: minmax(320px, 1fr) 260px minmax(420px, 1.35fr); gap: 1rem; margin-top: 1rem; align-items: start; }
@media (max-width: 1100px) {
  .builder-workspace { grid-template-columns: 1fr 1fr; }
  .builder-form-column { grid-column: 1 / -1; }
  .builder-map-column { position: static; }
}
@media (max-width: 720px) {
  .builder-workspace { grid-template-columns: 1fr; }
  .builder-form-column { grid-column: auto; }
}
</style>
